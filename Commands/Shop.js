const { SlashCommandBuilder } = require("discord.js");
const { list } = require("../Utils/shop");
const { reply, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shop")
        .setDescription("Магазин"),

    async execute(interaction) {
        const lines = list().map(item =>
            `${item.emoji} **${item.name}** — ${item.price}\n${item.description}`
        );

        return reply(interaction, {
            color: COLOR.pink,
            title: "Магазин",
            description: lines.join("\n\n")
        });
    }
};
