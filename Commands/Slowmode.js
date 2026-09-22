const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { reply, error } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Медленный режим")
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
            return error(interaction, "Нужно право Manage Channels.");
        }

        if (!interaction.channel?.setRateLimitPerUser) {
            return error(interaction, "Здесь недоступно.");
        }

        const seconds = interaction.options.getInteger("seconds");

        if (seconds == null || seconds < 0 || seconds > 21600) {
            return error(interaction, "Секунды от 0 до 21600.");
        }

        try {
            await interaction.channel.setRateLimitPerUser(seconds);
        } catch {
            return error(interaction, "Не удалось поставить.");
        }

        return reply(interaction, {
            description: seconds
                ? `**${seconds}** сек.`
                : "Выключен."
        });
    }
};
