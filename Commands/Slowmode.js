const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Медленный режим канала")
        .addIntegerOption(option =>
            option
                .setName("seconds")
                .setDescription("0 чтобы выключить")
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .setDMPermission(false),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({
                content: "Нужно право Manage Channels.",
                ephemeral: true
            });
        }

        if (!interaction.channel?.setRateLimitPerUser) {
            return interaction.reply({
                content: "В этом канале медленный режим недоступен.",
                ephemeral: true
            });
        }

        const seconds = interaction.options.getInteger("seconds");

        if (seconds == null || seconds < 0 || seconds > 21600) {
            return interaction.reply({
                content: "Укажи секунды от 0 до 21600.",
                ephemeral: true
            });
        }

        try {
            await interaction.channel.setRateLimitPerUser(seconds);
        } catch {
            return interaction.reply({
                content: "Не удалось поставить медленный режим.",
                ephemeral: true
            });
        }

        await interaction.reply(
            seconds
                ? `Медленный режим: **${seconds}** сек.`
                : "Медленный режим выключен."
        );
    }
};
