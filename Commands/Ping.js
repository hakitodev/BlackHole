const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Проверить задержку бота"),

    async execute(interaction) {
        const sent = await interaction.reply({
            content: "Пинг...",
            fetchReply: true
        });

        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(
            `Понг. Шлюз: **${interaction.client.ws.ping}** мс · ответ: **${roundtrip}** мс`
        );
    }
};
