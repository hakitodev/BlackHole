const { SlashCommandBuilder } = require("discord.js");
const { runCollect, formatCollect } = require("../Utils/collect");
const { reply, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("collect")
        .setDescription("Собрать daily, work и crime"),
    aliases: ["col", "daily", "work", "crime", "w", "d"],

    async execute(interaction) {
        const result = await runCollect(interaction.user.id);

        return reply(interaction, {
            title: "Сбор",
            color: result.claimed ? COLOR.gold : COLOR.blurple,
            description: formatCollect(result),
            ephemeral: !result.claimed
        });
    }
};
