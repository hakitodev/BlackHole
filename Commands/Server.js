const { SlashCommandBuilder } = require("discord.js");
const { reply, error, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("server")
        .setDescription("Сервер")
        .setDMPermission(false),

    async execute(interaction) {
        const guild = interaction.guild;

        if (!guild) {
            return error(interaction, "Только на сервере.");
        }

        const created = Math.floor(guild.createdTimestamp / 1000);
        return reply(interaction, {
            color: COLOR.blurple,
            title: guild.name,
            thumbnail: guild.iconURL({ size: 256 }),
            fields: [
                { name: "Участники", value: `${guild.memberCount}`, inline: true },
                { name: "Каналы", value: `${guild.channels.cache.size}`, inline: true },
                { name: "Роли", value: `${guild.roles.cache.size}`, inline: true },
                { name: "Бусты", value: `${guild.premiumSubscriptionCount ?? 0}`, inline: true },
                { name: "Создан", value: `<t:${created}:D>`, inline: true },
                { name: "ID", value: guild.id, inline: true }
            ]
        });
    }
};
