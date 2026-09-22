const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { requireStaff } = require("../Utils/staff");
const { rawAmount, parseAmount, amountMessage } = require("../Utils/amount");
const { reply, error, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("take")
        .setDescription("Забрать монеты")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("У кого забрать или ответ на сообщение")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("amount")
                .setDescription("Сумма или all")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!(await requireStaff(interaction))) {
            return;
        }

        const target = interaction.options.getUser("user");

        if (!target) {
            return error(interaction, "Укажи пользователя или ответь на сообщение.");
        }

        if (target.bot) {
            return error(interaction, "У ботов нет кошелька.");
        }

        const user = await economy.getUser(target.id);
        const parsed = parseAmount(rawAmount(interaction), {
            max: 1000000,
            available: user.balance + user.bank
        });

        if (!parsed.ok) {
            return error(interaction, amountMessage(parsed, { max: 1000000 }));
        }

        const result = await economy.takeBalance(target.id, parsed.amount);

        if (!result.ok) {
            return error(interaction, `Всего у ${target}: **${result.total}**.`);
        }

        return reply(interaction, {
            color: COLOR.gold,
            description: `${interaction.user} забрал у ${target} **${result.amount}**`
        });
    }
};
