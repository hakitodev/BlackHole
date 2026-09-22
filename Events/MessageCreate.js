const { PREFIX } = require("../Config");
const economy = require("../Database/Economy");
const { stripPrefix, splitCommand } = require("../Utils/prefix");
const { createMessageContext } = require("../Utils/messageCommand");
const { runCommand, resolveCommand } = require("../Utils/runCommand");

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

module.exports = {
    name: "messageCreate",
    async execute(client, message) {
        if (message.author.bot) {
            return;
        }

        let prefix = PREFIX;
        if (message.guild) {
            const settings = await economy.getGuildSettings(message.guild.id);
            if (!settings.prefix) {
                return;
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
        if (!command) {
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
    }
};
