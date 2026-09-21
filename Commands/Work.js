const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { integer, pick } = require("../Utils/random");
const { formatDuration } = require("../Utils/time");

const COOLDOWN = 45 * 60 * 1000;

const JOBS = [
    { text: "отработал смену в магазине", min: 80, max: 180 },
    { text: "развёз заказы", min: 90, max: 200 },
    { text: "починил кому-то компьютер", min: 120, max: 260 },
    { text: "постоял на ресепшене", min: 70, max: 160 },
    { text: "помог с переездом", min: 110, max: 240 }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("work")
        .setDescription("Поработать и заработать монет"),

    async execute(interaction) {
        const job = pick(JOBS);
        const payout = integer(job.min, job.max);
        const result = await economy.claimWork(interaction.user.id, payout, COOLDOWN);

        if (!result.ok) {
            return interaction.reply({
                content: `Отдых. Следующая смена через ${formatDuration(result.nextAt - Date.now())}.`,
                ephemeral: true
            });
        }

        const levelUp = result.leveled
            ? `\nНовый уровень: **${result.level}**`
            : "";

        await interaction.reply(
            `Ты ${job.text} и получил **${result.amount}** монет.${levelUp}`
        );
    }
};
