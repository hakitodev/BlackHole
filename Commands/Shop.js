const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { list } = require("../Utils/shop");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shop")
        .setDescription("Магазин"),

    async execute(interaction) {
        const lines = list().map(item =>
            `${item.emoji} **${item.name}** — ${item.price} монет\n${item.description}`
        );

        const embed = new EmbedBuilder()
            .setColor(0xEB459E)
            .setTitle("Магазин")
            .setDescription(lines.join("\n\n"))
            .setFooter({ text: "/buy чтобы купить" });

        await interaction.reply({ embeds: [embed] });
    }
};
