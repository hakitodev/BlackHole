const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Удалить сообщения в канале")
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Сколько сообщений")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: "Нужно право Manage Messages.",
                ephemeral: true
            });
        }

        if (!interaction.channel?.bulkDelete) {
            return interaction.reply({
                content: "Здесь нельзя чистить сообщения.",
                ephemeral: true
            });
        }

        const amount = interaction.options.getInteger("amount");

        if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
            return interaction.reply({
                content: "Укажи число сообщений от 1 до 100.",
                ephemeral: true
            });
        }

        try {
            const deleted = await interaction.channel.bulkDelete(amount, true);
            await interaction.reply({
                content: `Удалено **${deleted.size}** сообщений.`,
                ephemeral: true
            });
        } catch {
            await interaction.reply({
                content: "Не получилось удалить. Сообщения старше 14 дней Discord не чистит пачкой.",
                ephemeral: true
            });
        }
    }
};
