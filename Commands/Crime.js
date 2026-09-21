const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { integer, pick } = require("../Utils/random");
const { formatDuration } = require("../Utils/time");

const COOLDOWN = 2 * 60 * 60 * 1000;

const CRIMES = [
    "ограбил ларёк",
    "взломал автомат",
    "утащил посылку",
    "снял магнитолу"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("crime")
        .setDescription("Рискованное дело: можно выиграть или потерять"),

    async execute(interaction) {
        const success = Math.random() < 0.55;
        const payout = integer(180, 480);
        const fine = integer(80, 220);
        const result = await economy.commitCrime(
            interaction.user.id,
            COOLDOWN,
            success,
            payout,
            fine
        );

        if (!result.ok) {
            return interaction.reply({
                content: `Слишком жарко. Попробуй через ${formatDuration(result.nextAt - Date.now())}.`,
                ephemeral: true
            });
        }

        const action = pick(CRIMES);

        if (result.success) {
            const levelUp = result.leveled ? `\nНовый уровень: **${result.level}**` : "";
            return interaction.reply(
                `Получилось: ты ${action} и унёс **${result.amount}** монет.${levelUp}`
            );
        }

        if (result.wiped) {
            return interaction.reply(
                `Тебя поймали, пока ${action}. Забрали все наличные.`
            );
        }

        await interaction.reply(
            `Тебя поймали, пока ${action}. Штраф **${result.amount}** монет.`
        );
    }
};
