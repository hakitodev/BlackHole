const { SlashCommandBuilder } = require("discord.js");
const { normalizeTopType, buildTopMessage } = require("../Utils/top");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("top")
        .setDescription("Топ по всем серверам бота")
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
            return interaction.reply({
                content: "Пока некого показывать.",
                ephemeral: true
            });
        }

        await interaction.reply(payload);
    }
};
