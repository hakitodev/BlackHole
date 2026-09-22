const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { requireGlobalOrGuildEco } = require("../Utils/staff");
const { rawAmount, parseAmount, amountMessage } = require("../Utils/amount");
const { PAY_MAX } = require("../Utils/limits");
const { forInteraction, GLOBAL_SCOPE } = require("../Utils/scope");
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
        const access = await requireGlobalOrGuildEco(interaction);
        if (!access) {
            return;
        }

        const target = interaction.options.getUser("user");
        const parsed = parseAmount(rawAmount(interaction), { min: 1, max: PAY_MAX });

        if (!target) {
            return error(interaction, "Укажи пользователя или ответь на сообщение.");
        }

        if (!parsed.ok || parsed.all) {
            return error(interaction, parsed.all ? "Укажи сумму." : amountMessage(parsed));
        }

        if (target.bot) {
            return error(interaction, "Нельзя выдавать ботам.");
        }

        const { scope } = await forInteraction(interaction);
        if (!access.global && scope === GLOBAL_SCOPE) {
            return error(interaction, "Серверные модеры не трогают всемирный кошелёк. Включи гильдийную экономику.");
        }
        const wallet = access.global ? scope : scope;

        await economy.addBalance(target.id, parsed.amount, wallet);

        return reply(interaction, {
            color: COLOR.gold,
            description: `${interaction.user} выдал ${target} **${parsed.amount}**`
        });
    }
};
