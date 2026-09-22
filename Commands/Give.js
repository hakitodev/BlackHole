const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { requireStaff } = require("../Utils/staff");
const { rawAmount, parseAmount, amountMessage } = require("../Utils/amount");
const { reply, error, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("give")
        .setDescription("Выдать монеты")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Получатель или ответ на сообщение")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("amount")
                .setDescription("Сумма")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!(await requireStaff(interaction))) {
            return;
        }

        const target = interaction.options.getUser("user");
        const parsed = parseAmount(rawAmount(interaction), { max: 1000000 });

        if (!target) {
            return error(interaction, "Укажи пользователя или ответь на сообщение.");
        }

        if (!parsed.ok || parsed.all) {
            return error(interaction, parsed.all ? "Укажи сумму." : amountMessage(parsed, { max: 1000000 }));
        }

        if (target.bot) {
            return error(interaction, "Нельзя выдавать ботам.");
        }

        await economy.addBalance(target.id, parsed.amount);

        return reply(interaction, {
            color: COLOR.gold,
            description: `${interaction.user} выдал ${target} **${parsed.amount}**`
        });
    }
};
