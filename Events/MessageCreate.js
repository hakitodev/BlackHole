const { PREFIX } = require("../Config");
const economy = require("../Database/Economy");
const { stripPrefix, splitCommand } = require("../Utils/prefix");
const { createMessageContext } = require("../Utils/messageCommand");
const { runCommand, resolveCommand } = require("../Utils/runCommand");
const { canGainXp, xpGain } = require("../Utils/xp");
const { parseWords, hasInvite, findBannedWord, isPrivileged } = require("../Utils/automod");
const { fireEvent } = require("../Utils/events");
const { customPayload } = require("../Utils/customEmbed");
const { remember } = require("../Utils/profile");

async function repliedUser(message) {
    if (message.mentions.repliedUser) {
        return message.mentions.repliedUser;
    }

    if (!message.reference) {
        return null;
    }

    const referenced = await message.fetchReference().catch(() => null);
    return referenced?.author ?? null;
}

async function handleAutomod(message, settings) {
    if (!message.guild || isPrivileged(message.member)) {
        return false;
    }

    const words = parseWords(settings.automodWords);
    const inviteHit = settings.automodInvites && hasInvite(message.content);
    const wordHit = findBannedWord(message.content, words);
    if (!inviteHit && !wordHit) {
        return false;
    }

    await message.delete().catch(() => {});
    const reason = inviteHit ? "инвайт" : `слово «${wordHit}»`;
    await fireEvent(message.guild, "automodLog", {
        user: message.author,
        channel: `${message.channel}`,
        reason,
        text: String(message.content || "").slice(0, 400)
    });
    return true;
}

module.exports = {
    name: "messageCreate",
    async execute(client, message) {
        if (message.author.bot) {
            return;
        }

        remember(message.author).catch(() => {});

        let prefix = PREFIX;
        let settings = null;

        if (message.guild) {
            settings = await economy.getGuildSettings(message.guild.id);
            if (await handleAutomod(message, settings)) {
                return;
            }

            if (settings.xpOn !== false && canGainXp(message.guild.id, message.author.id)) {
                const progress = await economy.addXp(
                    message.author.id,
                    xpGain(),
                    settings.levelMoney
                );
                if (progress?.leveled) {
                    await fireEvent(message.guild, "levelUp", {
                        user: message.author,
                        level: progress.level,
                        money: progress.money,
                        xp: progress.xp
                    }, message.channel);
                }
            }

            prefix = settings.prefixText || PREFIX;
        }

        const rest = stripPrefix(message.content, prefix, client.user.id);
        if (rest === null) {
            return;
        }

        const split = splitCommand(rest);
        if (!split) {
            return;
        }

        const command = resolveCommand(client, split.name);
        if (command) {
            if (message.guild && settings && !settings.prefix) {
                return;
            }
            const target = await repliedUser(message);
            const interaction = await createMessageContext(
                message,
                command,
                split.rest,
                target
            );
            await runCommand(command, interaction);
            return;
        }

        if (!message.guild) {
            return;
        }

        const custom = await economy.getCustomCommand(message.guild.id, split.name);
        if (!custom) {
            return;
        }

        const payload = customPayload(custom, {
            user: message.author,
            guild: message.guild
        });
        if (!payload.content && !payload.embeds) {
            return;
        }
        await message.channel.send(payload).catch(() => {});
    }
};
