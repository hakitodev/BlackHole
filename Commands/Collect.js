const { SlashCommandBuilder } = require("discord.js");
const { runCollect, formatCollect } = require("../Utils/collect");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("collect")
        .setDescription("Собрать daily, work и crime за один раз"),
    aliases: ["col", "daily", "work", "crime", "w", "d"],

    async execute(interaction) {
        const result = await runCollect(interaction.user.id);

        await interaction.reply({
            content: formatCollect(result),
            ephemeral: !result.claimed
        });
    }
};
