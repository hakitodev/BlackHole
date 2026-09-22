const { SlashCommandBuilder } = require("discord.js");
const { normalizeTopType, buildTopMessage } = require("../Utils/top");
const { error } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("top")
        .setDescription("Топ")
        .addStringOption(option =>
            option
                .setName("type")
                .setDescription("Категория")
                .addChoices(
                    { name: "Деньги", value: "money" },
                    { name: "Уровень", value: "level" }
                )
        ),
    aliases: ["lb", "leaderboard"],

    async execute(interaction) {
        const type = normalizeTopType(interaction.options.getString("type") ?? "money");
        const payload = await buildTopMessage(type, 0);

        if (!payload) {
            return error(interaction, "Пока некого показывать.");
        }

        await interaction.reply(payload);
    }
};
