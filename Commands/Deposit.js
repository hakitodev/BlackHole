const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dep")
        .setDescription("Положить деньги в банк")
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Сумма")
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction) {
        const amount = interaction.options.getInteger("amount");

        if (!Number.isInteger(amount) || amount < 1) {
            return interaction.reply({
                content: "Укажи сумму.",
                ephemeral: true
            });
        }

        const result = await economy.deposit(interaction.user.id, amount);

        if (!result.ok) {
            return interaction.reply({
                content: "Недостаточно наличных.",
                ephemeral: true
            });
        }

        await interaction.reply(`В банк положено **${amount}** монет.`);
    }
};
