const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("with")
        .setDescription("Снять деньги из банка")
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Сумма")
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction) {
        const amount = interaction.options.getInteger("amount");
        const result = await economy.withdraw(interaction.user.id, amount);

        if (!result.ok) {
            return interaction.reply({
                content: "Недостаточно средств в банке.",
                ephemeral: true
            });
        }

        await interaction.reply(`Из банка снято **${amount}** монет.`);
    }
};
