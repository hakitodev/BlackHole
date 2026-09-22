const { EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { guildLog } = require("../Utils/log");

module.exports = {
    name: "messageDelete",
    async execute(client, message) {
        if (!message.guild || message.author?.bot) {
            return;
        }

        const settings = await economy.getGuildSettings(message.guild.id);
        const snippet = String(message.content || "").slice(0, 800) || "без текста";

        await guildLog(message.guild, settings, "messages", {
            embeds: [
                new EmbedBuilder()
                    .setColor(0xED4245)
                    .setDescription(`Удалено в ${message.channel}\n${message.author || "кто-то"}: ${snippet}`)
            ]
        });
    }
};
