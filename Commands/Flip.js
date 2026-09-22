const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { remaining, hit, formatSeconds } = require("../Utils/cooldown");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("flip")
        .setDescription("Орёл или решка: удвоить ставку или потерять")
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Ставка")
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(10000)
        ),

    aliases: ["coinflip", "cf"],

    async execute(interaction) {
        const amount = interaction.options.getInteger("amount");

        if (!Number.isInteger(amount) || amount < 10 || amount > 10000) {
            return interaction.reply({
                content: "Ставка от 10 до 10000.",
                ephemeral: true
            });
        }

        const key = `flip:${interaction.user.id}`;
        const wait = remaining(key);

        if (wait) {
            return interaction.reply({
                content: `Подожди ${formatSeconds(wait)} сек.`,
                ephemeral: true
            });
        }

        const win = Math.random() < 0.5;
        const result = await economy.flipBet(interaction.user.id, amount, win);

        if (!result.ok) {
            return interaction.reply({
                content: "Недостаточно наличных.",
                ephemeral: true
            });
        }

        hit(key, 4000);

        if (result.win) {
            return interaction.reply(
                `Орёл! ${interaction.user} выиграл **${result.amount}** монет.`
            );
        }

        await interaction.reply(
            `Решка. ${interaction.user} проиграл **${result.amount}** монет.`
        );
    }
};
