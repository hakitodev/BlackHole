const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { rawAmount, parseAmount, amountMessage } = require("../Utils/amount");
const { PAY_MAX } = require("../Utils/limits");
const { forInteraction } = require("../Utils/scope");
const { reply, error, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("with")
        .setDescription("Снять деньги из банка")
        .addStringOption(option =>
            option
                .setName("amount")
                .setDescription("Сумма или all")
                .setRequired(true)
        ),
    aliases: ["withdraw"],

    async execute(interaction) {
        const { scope } = await forInteraction(interaction);
        const user = await economy.getUser(interaction.user.id, scope);
        const parsed = parseAmount(rawAmount(interaction), {
            min: 1,
            max: PAY_MAX,
            available: user.bank
        });

        if (!parsed.ok) {
            return error(interaction, amountMessage(parsed, { min: 1 }));
        }

        const result = await economy.withdraw(interaction.user.id, parsed.amount, scope);

        if (!result.ok) {
            return error(interaction, "Недостаточно в банке.");
        }

        return reply(interaction, {
            color: COLOR.gold,
            description: `Из банка: **${parsed.amount}**`
        });
    }
};
