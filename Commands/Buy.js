const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { get, find, list, format } = require("../Utils/shop");
const { reply, error, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("buy")
        .setDescription("Купить предмет")
        .addStringOption(option =>
            option
                .setName("item")
                .setDescription("Предмет")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option
                .setName("qty")
                .setDescription("Количество")
                .setMinValue(1)
                .setMaxValue(50)
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase();
        const choices = (await list(interaction.guildId))
            .filter(item =>
                item.id.includes(focused) ||
                item.name.toLowerCase().includes(focused)
            )
            .slice(0, 25);

        await interaction.respond(
            choices.map(item => ({
                name: `${item.emoji} ${item.name} — ${item.price}`.slice(0, 100),
                value: item.id
            }))
        );
    },

    async execute(interaction) {
        const itemId = interaction.options.getString("item");
        const settings = interaction.guild
            ? await economy.getGuildSettings(interaction.guild.id)
            : { buyMax: 20 };
        const buyMax = settings.buyMax || 20;
        const qty = interaction.options.getInteger("qty") ?? 1;
        const item = await find(interaction.guildId, itemId)
            ?? await get(itemId, interaction.guildId);

        if (!item) {
            return error(interaction, "Такого предмета нет.");
        }

        if (!Number.isInteger(qty) || qty < 1 || qty > buyMax) {
            return error(interaction, `Количество от 1 до ${buyMax}.`);
        }

        const result = await economy.buyItem(interaction.user.id, item.id, item.price, qty);

        if (!result.ok) {
            return error(interaction, `Нужно **${item.price * qty}**.`);
        }

        return reply(interaction, {
            color: COLOR.pink,
            description: `${interaction.user} купил ${format(item)} × **${qty}** за **${result.cost}**`
        });
    }
};
