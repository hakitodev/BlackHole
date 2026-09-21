const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { integer } = require("../Utils/random");
const { formatDuration } = require("../Utils/time");

const COOLDOWN = 90 * 60 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rob")
        .setDescription("Украсть наличные у другого игрока")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Жертва")
                .setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser("user");

        if (target.bot) {
            return interaction.reply({
                content: "Ботов грабить бессмысленно.",
                ephemeral: true
            });
        }

        if (target.id === interaction.user.id) {
            return interaction.reply({
                content: "Нельзя ограбить самого себя.",
                ephemeral: true
            });
        }

        const victim = await economy.getUser(target.id);

        if (victim.balance < 50) {
            return interaction.reply({
                content: "У этого человека почти нет наличных. Деньги в банке не украсть.",
                ephemeral: true
            });
        }

        const success = Math.random() < 0.35;
        const steal = Math.max(50, Math.floor(victim.balance * (integer(15, 35) / 100)));
        const fine = integer(80, 180);

        const result = await economy.attemptRob(
            interaction.user.id,
            target.id,
            COOLDOWN,
            success,
            steal,
            fine
        );

        if (!result.ok && result.reason === "cooldown") {
            return interaction.reply({
                content: `Подожди ${formatDuration(result.nextAt - Date.now())}.`,
                ephemeral: true
            });
        }

        if (!result.ok) {
            return interaction.reply({
                content: "У цели нечего брать с наличных.",
                ephemeral: true
            });
        }

        if (result.success) {
            const levelUp = result.leveled ? `\nНовый уровень: **${result.level}**` : "";
            return interaction.reply(
                `${interaction.user} украл **${result.amount}** монет у ${target}.${levelUp}`
            );
        }

        if (result.wiped) {
            return interaction.reply(
                `${interaction.user} попался на ограблении ${target}. Забрали все наличные.`
            );
        }

        await interaction.reply(
            `${interaction.user} попался. Компенсация ${target}: **${result.amount}** монет.`
        );
    }
};
