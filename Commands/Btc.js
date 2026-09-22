const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { parseAmount, amountMessage, isAll } = require("../Utils/amount");
const { BTC_MAX_COINS } = require("../Utils/limits");
const { forInteraction } = require("../Utils/scope");
const { reply, error, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("btc")
        .setDescription("Биткоин")
        .addSubcommand(sub =>
            sub.setName("price").setDescription("Курс")
        )
        .addSubcommand(sub =>
            sub
                .setName("buy")
                .setDescription("Купить")
                .addStringOption(option =>
                    option.setName("amount").setDescription("Сколько монет или all").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("sell")
                .setDescription("Продать")
                .addStringOption(option =>
                    option.setName("amount").setDescription("Сколько монет или all").setRequired(true)
                )
        ),
    aliases: ["bitcoin", "биток"],

    async execute(interaction) {
        const sub = interaction.options.getSubcommand(false) || "price";
        const price = await economy.btcPrice();
        const { scope } = await forInteraction(interaction);
        const user = await economy.getUser(interaction.user.id, scope);

        if (sub === "price") {
            return reply(interaction, {
                color: COLOR.gold,
                title: "BTC",
                description:
                    `Курс: **${price}** за монету\n` +
                    `У тебя: **${user.btc}** BTC`
            });
        }

        const raw = interaction.options.getString("amount");
        if (sub === "buy") {
            const max = Math.min(BTC_MAX_COINS, Math.floor(user.balance / price));
            const parsed = parseAmount(isAll(raw) ? "all" : raw, {
                min: 1,
                max: BTC_MAX_COINS,
                available: max
            });
            if (!parsed.ok) {
                return error(interaction, amountMessage(parsed, { min: 1, max: BTC_MAX_COINS }));
            }
            const result = await economy.buyBtc(interaction.user.id, parsed.amount, scope);
            if (!result.ok) {
                return error(interaction, `Нужно **${price * parsed.amount}**.`);
            }
            return reply(interaction, {
                color: COLOR.green,
                description: `Купил **${result.coins}** BTC по **${result.price}**. −**${result.cost}**`
            });
        }

        const parsed = parseAmount(isAll(raw) ? "all" : raw, {
            min: 1,
            max: BTC_MAX_COINS,
            available: user.btc
        });
        if (!parsed.ok) {
            return error(interaction, amountMessage(parsed, { min: 1, max: BTC_MAX_COINS }));
        }
        const result = await economy.sellBtc(interaction.user.id, parsed.amount, scope);
        if (!result.ok) {
            return error(interaction, "Не хватает BTC.");
        }
        return reply(interaction, {
            color: COLOR.green,
            description: `Продал **${result.coins}** BTC по **${result.price}**. +**${result.payout}**`
        });
    }
};
