const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");

const REWARD = 500;
const COOLDOWN = 24 * 60 * 60 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("daily")
        .setDescription("Получить ежедневную награду"),

    async execute(interaction) {
        const result = await economy.claimDaily(
            interaction.user.id,
            REWARD,
            COOLDOWN
        );

        if (!result.ok) {
            const hours = Math.max(
                1,
                Math.ceil((result.nextAt - Date.now()) / 3600000)
            );

            return interaction.reply({
                content: `Следующая награда через ${hours} ч.`,
                ephemeral: true
            });
        }

        await interaction.reply({
            content: `Ты получил **${result.amount}** монет!`
        });
    }
};
