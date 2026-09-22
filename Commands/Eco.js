const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { requireGlobalOrGuildEco } = require("../Utils/staff");
const { forInteraction, GLOBAL_SCOPE } = require("../Utils/scope");
const { reply, error, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("eco")
        .setDescription("Правка кошелька — высшие модеры и владелец")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Чей кошелёк")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("balance")
                .setDescription("Наличные")
                .setMinValue(0)
        )
        .addIntegerOption(option =>
            option
                .setName("bank")
                .setDescription("Банк")
                .setMinValue(0)
        ),

    async execute(interaction) {
        const access = await requireGlobalOrGuildEco(interaction);
        if (!access) {
            return;
        }

        const target = interaction.options.getUser("user");
        if (!target || target.bot) {
            return error(interaction, target?.bot ? "У ботов нет кошелька." : "Укажи пользователя.");
        }

        const { scope } = await forInteraction(interaction);
        if (!access.global && scope === GLOBAL_SCOPE) {
            return error(interaction, "Серверные модеры не трогают всемирный кошелёк.");
        }

        const balance = interaction.options.getInteger("balance");
        const bank = interaction.options.getInteger("bank");

        if (balance === null && bank === null) {
            const user = await economy.getUser(target.id, scope);
            return reply(interaction, {
                color: COLOR.gold,
                title: target.username,
                description: `Наличные **${user.balance}**\nБанк **${user.bank}**`,
                ephemeral: true
            });
        }

        const next = await economy.setWallet(target.id, {
            balance: balance ?? undefined,
            bank: bank ?? undefined
        }, scope);

        return reply(interaction, {
            color: COLOR.gold,
            description: `${target}: наличные **${next.balance}**, банк **${next.bank}**`
        });
    }
};
