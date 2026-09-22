const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { reply, COLOR } = require("../Utils/reply");

function block(title, items) {
    if (!items.length) {
        return `**${title}**\nпусто`;
    }
    return `**${title}**\n` + items.map(item =>
        `${item.emoji} **${item.name}** — ${item.price}\n${item.description}`
    ).join("\n\n");
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shop")
        .setDescription("Магазин"),

    async execute(interaction) {
        const global = await economy.listShopItems("global");
        const local = interaction.guildId
            ? await economy.listShopItems(interaction.guildId)
            : [];
        const taken = new Set(local.map(item => item.id));
        const world = global.filter(item => !taken.has(item.id));

        if (!world.length && !local.length) {
            return reply(interaction, {
                color: COLOR.pink,
                title: "Магазин",
                description: "Пока пусто."
            });
        }

        const text = [block("Всемирный", world), block("Сервер", local)].join("\n\n");
        return reply(interaction, {
            color: COLOR.pink,
            title: "Магазин",
            description: text.slice(0, 4000)
        });
    }
};
