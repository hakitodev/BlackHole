const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("top")
        .setDescription("Топ по деньгам"),

    async execute(interaction) {
        const users = await economy.getTop(10);

        if (!users.length) {
            return interaction.reply({
                content: "Пока никто не заработал монет.",
                ephemeral: true
            });
        }

        const lines = users.map((user, index) => {
            const total = user.balance + user.bank;
            return `**${index + 1}.** <@${user.id}> — **${total}**`;
        });

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle("Топ богачей")
            .setDescription(lines.join("\n"));

        await interaction.reply({ embeds: [embed] });
    }
};
