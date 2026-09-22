const { EmbedBuilder } = require("discord.js");
const { PREFIX } = require("../Config");
const economy = require("../Database/Economy");
const { stripPrefix, splitCommand } = require("../Utils/prefix");
const { createMessageContext } = require("../Utils/messageCommand");
const { runCommand, resolveCommand } = require("../Utils/runCommand");
const { fill } = require("../Utils/placeholders");
const { guildLog } = require("../Utils/log");
const { getChannel } = require("../Utils/channel");
const { canGainXp, xpGain } = require("../Utils/xp");
const { parseWords, hasInvite, findBannedWord, isPrivileged } = require("../Utils/automod");

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
    await guildLog(message.guild, settings, "mod", {
        embeds: [
            new EmbedBuilder()
                .setColor(0xFEE75C)
                .setDescription(
                    `Автомод удалил сообщение ${message.author} в ${message.channel}: ${
                        inviteHit ? "инвайт" : `слово «${wordHit}»`
                    }`
                )
        ]
    });
    return true;
}

async function handleLevelUp(message, settings, progress) {
    if (!settings.levelsOn || !progress?.leveled) {
        return;
    }

    const text = fill(
        settings.levelsMessage || "{user} теперь {level} уровень!",
        { user: message.author, guild: message.guild, level: progress.level }
    );
    const channel = settings.levelsChannel
        ? await getChannel(message.guild, settings.levelsChannel)
        : message.channel;

    if (!channel) {
        return;
    }

    await channel.send({
        embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription(text)]
    }).catch(() => {});
}

module.exports = {
    name: "messageCreate",
    async execute(client, message) {
        if (message.author.bot) {
            return;
        }

        let prefix = PREFIX;
        let settings = null;

        if (message.guild) {
            settings = await economy.getGuildSettings(message.guild.id);
            if (await handleAutomod(message, settings)) {
                return;
            }

            if (canGainXp(message.guild.id, message.author.id)) {
                const progress = await economy.addXp(message.author.id, xpGain());
                await handleLevelUp(message, settings, progress);
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

        await message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setDescription(fill(custom.response, {
                        user: message.author,
                        guild: message.guild
                    }))
            ]
        }).catch(() => {});
    }
};
