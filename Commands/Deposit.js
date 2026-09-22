const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { rawAmount, parseAmount, amountMessage } = require("../Utils/amount");
const { reply, error, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dep")
        .setDescription("Положить деньги в банк")
        .addStringOption(option =>
            option
                .setName("amount")
                .setDescription("Сумма или all")
                .setRequired(true)
        ),
    aliases: ["deposit"],

    async execute(interaction) {
        const user = await economy.getUser(interaction.user.id);
        const parsed = parseAmount(rawAmount(interaction), { available: user.balance });

        if (!parsed.ok) {
            return error(interaction, amountMessage(parsed));
        }

        const result = await economy.deposit(interaction.user.id, parsed.amount);

        if (!result.ok) {
            return error(interaction, "Недостаточно наличных.");
        }

        return reply(interaction, {
            color: COLOR.gold,
            description: `В банк: **${parsed.amount}**`
        });
    }
};
