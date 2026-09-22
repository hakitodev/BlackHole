const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { requireGlobalOrGuildEco } = require("../Utils/staff");
const { rawAmount, parseAmount, amountMessage } = require("../Utils/amount");
const { PAY_MAX } = require("../Utils/limits");
const { forInteraction, GLOBAL_SCOPE } = require("../Utils/scope");
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
        const access = await requireGlobalOrGuildEco(interaction);
        if (!access) {
            return;
        }

        const target = interaction.options.getUser("user");

        if (!target) {
            return error(interaction, "Укажи пользователя или ответь на сообщение.");
        }

        if (target.bot) {
            return error(interaction, "У ботов нет кошелька.");
        }

        const { scope } = await forInteraction(interaction);
        if (!access.global && scope === GLOBAL_SCOPE) {
            return error(interaction, "Серверные модеры не трогают всемирный кошелёк. Включи гильдийную экономику.");
        }

        const user = await economy.getUser(target.id, scope);
        const parsed = parseAmount(rawAmount(interaction), {
            min: 1,
            max: PAY_MAX,
            available: user.balance + user.bank
        });

        if (!parsed.ok) {
            return error(interaction, amountMessage(parsed));
        }

        const result = await economy.takeBalance(target.id, parsed.amount, scope);

        if (!result.ok) {
            return error(interaction, `Всего у ${target}: **${result.total}**.`);
        }

        return reply(interaction, {
            color: COLOR.gold,
            description: `${interaction.user} забрал у ${target} **${result.amount}**`
        });
    }
};
