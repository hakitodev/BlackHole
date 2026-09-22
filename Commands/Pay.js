const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { remaining, hit, formatSeconds } = require("../Utils/cooldown");
const { rawAmount, parseAmount, amountMessage } = require("../Utils/amount");
const { PAY_MAX } = require("../Utils/limits");
const { forInteraction } = require("../Utils/scope");
const { reply, error, COLOR } = require("../Utils/reply");

async function resolveTarget(interaction) {
    const selected = interaction.options.getUser("user");
    if (selected) {
        return selected;
    }

    const rawId = interaction.options.getString("id")?.trim();
    if (!rawId) {
        return null;
    }

    if (!/^\d{17,20}$/.test(rawId)) {
        return false;
    }

    return interaction.client.users.fetch(rawId).catch(() => false);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pay")
        .setDescription("Перевести наличные")
        .addStringOption(option =>
            option
                .setName("amount")
                .setDescription("Сумма или all")
                .setRequired(true)
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Получатель или ответ на сообщение")
        )
        .addStringOption(option =>
            option
                .setName("id")
                .setDescription("Discord ID")
        ),

    async execute(interaction) {
        const target = await resolveTarget(interaction);

        if (target === false) {
            return error(interaction, "Пользователь не найден.");
        }

        if (!target) {
            return error(interaction, "Укажи пользователя или ответь на сообщение.");
        }

        if (target.bot) {
            return error(interaction, "Нельзя переводить ботам.");
        }

        if (target.id === interaction.user.id) {
            return error(interaction, "Нельзя перевести себе.");
        }

        const { scope } = await forInteraction(interaction);
        const user = await economy.getUser(interaction.user.id, scope);
        const parsed = parseAmount(rawAmount(interaction), {
            min: 1,
            max: PAY_MAX,
            available: user.balance
        });

        if (!parsed.ok) {
            return error(interaction, amountMessage(parsed, { min: 1, max: PAY_MAX }));
        }

        const key = `pay:${interaction.user.id}`;
        const wait = remaining(key);

        if (wait) {
            return error(interaction, `Подожди ${formatSeconds(wait)} сек.`);
        }

        hit(key, 3000);

        const result = await economy.transfer(
            interaction.user.id,
            target.id,
            parsed.amount,
            scope
        );

        if (!result.ok) {
            return error(interaction, "Недостаточно наличных.");
        }

        return reply(interaction, {
            color: COLOR.gold,
            description: `${interaction.user} перевёл **${parsed.amount}** ${target}`
        });
    }
};
