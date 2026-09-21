const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("server")
        .setDescription("Информация о сервере")
        .setDMPermission(false),

    async execute(interaction) {
        const guild = interaction.guild;

        if (!guild) {
            return interaction.reply({
                content: "Команда только для сервера.",
                ephemeral: true
            });
        }

        const created = Math.floor(guild.createdTimestamp / 1000);
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(guild.name)
            .setThumbnail(guild.iconURL({ size: 256 }))
            .addFields(
                { name: "Участники", value: `${guild.memberCount}`, inline: true },
                { name: "Каналы", value: `${guild.channels.cache.size}`, inline: true },
                { name: "Роли", value: `${guild.roles.cache.size}`, inline: true },
                { name: "Бусты", value: `${guild.premiumSubscriptionCount ?? 0}`, inline: true },
                { name: "Создан", value: `<t:${created}:D>`, inline: true },
                { name: "ID", value: guild.id, inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    }
};
