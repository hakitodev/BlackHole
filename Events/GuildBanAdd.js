const { EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { guildLog } = require("../Utils/log");

module.exports = {
    name: "guildBanAdd",
    async execute(client, ban) {
        const settings = await economy.getGuildSettings(ban.guild.id);
        await guildLog(ban.guild, settings, "mod", {
            embeds: [
                new EmbedBuilder()
                    .setColor(0xED4245)
                    .setDescription(`Бан: **${ban.user.tag}**\n${ban.reason || "причина отсутствует"}`)
            ]
        });
    }
};
