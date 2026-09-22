const { SlashCommandBuilder } = require("discord.js");
const { buildShopMessage } = require("../Utils/shopView");
const { error } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shop")
        .setDescription("Магазин")
        .addStringOption(option =>
            option
                .setName("scope")
                .setDescription("Витрина")
                .addChoices(
                    { name: "Всемирный", value: "global" },
                    { name: "Сервер", value: "guild" }
                )
        ),

    async execute(interaction) {
        const scope = interaction.options.getString("scope") ?? "global";
        const payload = await buildShopMessage(interaction.guildId, scope);
        if (!payload) {
            return error(interaction, "Пока пусто.");
        }
        await interaction.reply(payload);
    }
};
