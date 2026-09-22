const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const economy = require("../Database/Economy");
const { get, find, list, format } = require("../Utils/shop");
const { forInteraction } = require("../Utils/scope");
const { parseColor, isHexColor } = require("../Utils/color");
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
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase();
        const settings = interaction.guildId
            ? await economy.getGuildSettings(interaction.guildId)
            : {};
        const choices = (await list(interaction.guildId, settings))
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
        const qty = interaction.options.getInteger("qty") ?? 1;
        const { scope, settings } = await forInteraction(interaction);
        if (settings.shopGlobal === false && settings.shopGuild === false) {
            return error(interaction, "Магазин выключен.");
        }
        const item = await find(interaction.guildId, itemId)
            ?? await get(itemId, interaction.guildId);

        if (!item) {
            return error(interaction, "Такого предмета нет.");
        }

        if (!Number.isInteger(qty) || qty < 1) {
            return error(interaction, "Количество от 1.");
        }

        if (item.kind === "role") {
            if (qty !== 1) {
                return error(interaction, "Одну роль за раз.");
            }
            if (!interaction.guild) {
                return error(interaction, "Цветные роли только на сервере.");
            }
            const me = interaction.guild.members.me;
            if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
                return error(interaction, "Боту нужны права на роли.");
            }
            const hex = String(item.hex || item.extra?.hex || "").trim();
            if (!isHexColor(hex)) {
                return error(interaction, "У роли нет цвета.");
            }
            const color = parseColor(hex, null);
            if (color == null) {
                return error(interaction, "У роли нет цвета.");
            }
            const spent = await economy.removeBalance(interaction.user.id, item.price, scope);
            if (!spent) {
                return error(interaction, `Нужно **${item.price}**.`);
            }
            try {
                const role = await interaction.guild.roles.create({
                    name: item.name.slice(0, 100),
                    color,
                    reason: `shop ${interaction.user.id}`
                });
                await interaction.member.roles.add(role);
            } catch (err) {
                await economy.addBalance(interaction.user.id, item.price, scope);
                return error(interaction, "Не вышло выдать роль. Деньги вернул.");
            }
            return reply(interaction, {
                color: COLOR.pink,
                description: `${interaction.user} купил роль **${item.name}** за **${item.price}**`
            });
        }

        const result = await economy.buyItem(interaction.user.id, item.id, item.price, qty, scope);

        if (!result.ok) {
            return error(interaction, `Нужно **${item.price * qty}**.`);
        }

        return reply(interaction, {
            color: COLOR.pink,
            description: `${interaction.user} купил ${format(item)} × **${qty}** за **${result.cost}**`
        });
    }
};
