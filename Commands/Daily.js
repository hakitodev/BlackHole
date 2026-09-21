const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { formatDuration } = require("../Utils/time");

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
            return interaction.reply({
                content: `Следующая награда через ${formatDuration(result.nextAt - Date.now())}.`,
                ephemeral: true
            });
        }

        const levelUp = result.leveled ? `\nНовый уровень: **${result.level}**` : "";

        await interaction.reply({
            content: `Ты получил **${result.amount}** монет.${levelUp}`
        });
    }
};
