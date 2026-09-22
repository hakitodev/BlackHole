const { SlashCommandBuilder } = require("discord.js");
const { buildShopMessage } = require("../Utils/shopView");
const { forInteraction } = require("../Utils/scope");
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
        const { settings } = await forInteraction(interaction);
        if (settings.shopGlobal === false && settings.shopGuild === false) {
            return error(interaction, "Магазин выключен.");
        }
        const scope = interaction.options.getString("scope") ?? "global";
        const payload = await buildShopMessage(interaction.guildId, scope);
        if (!payload) {
            return error(interaction, "Пока пусто.");
        }
        await interaction.reply(payload);
    }
};
