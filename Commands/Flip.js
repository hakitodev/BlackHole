const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { remaining, hit, formatSeconds } = require("../Utils/cooldown");
const { rawAmount, parseAmount, amountMessage } = require("../Utils/amount");
const { reply, error, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("flip")
        .setDescription("Орёл или решка")
        .addStringOption(option =>
            option
                .setName("amount")
                .setDescription("Ставка или all")
                .setRequired(true)
        ),
    aliases: ["coinflip", "cf"],

    async execute(interaction) {
        const settings = interaction.guild
            ? await economy.getGuildSettings(interaction.guild.id)
            : { flipMin: 10, flipMax: 10000 };
        const min = settings.flipMin || 10;
        const max = settings.flipMax || 10000;
        const user = await economy.getUser(interaction.user.id);
        const parsed = parseAmount(rawAmount(interaction), {
            min,
            max,
            available: user.balance
        });

        if (!parsed.ok) {
            return error(interaction, amountMessage(parsed, { min, max }));
        }

        const key = `flip:${interaction.user.id}`;
        const wait = remaining(key);

        if (wait) {
            return error(interaction, `Подожди ${formatSeconds(wait)} сек.`);
        }

        const win = Math.random() < 0.5;
        const result = await economy.flipBet(interaction.user.id, parsed.amount, win);

        if (!result.ok) {
            return error(interaction, "Недостаточно наличных.");
        }

        hit(key, 4000);

        return reply(interaction, {
            color: result.win ? COLOR.green : COLOR.red,
            description: result.win
                ? `Орёл. ${interaction.user} **+${result.amount}**`
                : `Решка. ${interaction.user} **−${result.amount}**`
        });
    }
};
