const { SlashCommandBuilder } = require("discord.js");
const { list } = require("../Utils/shop");
const { reply, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shop")
        .setDescription("Магазин"),

    async execute(interaction) {
        const items = await list(interaction.guildId);
        if (!items.length) {
            return reply(interaction, {
                color: COLOR.pink,
                title: "Магазин",
                description: "Пока пусто."
            });
        }

        const lines = items.map(item =>
            `${item.emoji} **${item.name}** — ${item.price}\n${item.description}`
        );

        return reply(interaction, {
            color: COLOR.pink,
            title: "Магазин",
            description: lines.join("\n\n").slice(0, 4000)
        });
    }
};
