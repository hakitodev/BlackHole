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

        if (message.guild && !(await economy.isPrefixEnabled(message.guild.id))) {
            return;
        }

        const rest = stripPrefix(message.content, PREFIX, client.user.id);
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
