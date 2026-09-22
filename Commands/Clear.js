const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { reply, error } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Удалить сообщения")
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Сколько")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
            return error(interaction, "Нужно право Manage Messages.");
        }

        if (!interaction.channel?.bulkDelete) {
            return error(interaction, "Здесь нельзя чистить.");
        }

        const amount = interaction.options.getInteger("amount");

        if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
            return error(interaction, "От 1 до 100.");
        }

        try {
            const deleted = await interaction.channel.bulkDelete(amount, true);
            return reply(interaction, {
                description: `Удалено **${deleted.size}**.`,
                ephemeral: true
            });
        } catch {
            return error(interaction, "Не вышло. Сообщения старше 14 дней так не удалить.");
        }
    }
};
