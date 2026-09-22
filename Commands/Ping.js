const { SlashCommandBuilder } = require("discord.js");
const { reply, editReply } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Задержка"),

    async execute(interaction) {
        const sent = await reply(interaction, {
            description: "…",
            fetchReply: true
        });

        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
        return editReply(interaction, {
            description: `Шлюз **${interaction.client.ws.ping}** мс · ответ **${roundtrip}** мс`
        });
    }
};
