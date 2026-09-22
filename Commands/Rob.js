const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { integer } = require("../Utils/random");
const { formatDuration } = require("../Utils/time");
const { reply, error, COLOR } = require("../Utils/reply");

const COOLDOWN = 90 * 60 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rob")
        .setDescription("Украсть наличные")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Жертва или ответ на сообщение")
                .setRequired(true)
        ),
    aliases: ["steal"],

    async execute(interaction) {
        const target = interaction.options.getUser("user");

        if (!target) {
            return error(interaction, "Укажи пользователя или ответь на сообщение.");
        }

        if (target.bot) {
            return error(interaction, "Ботов грабить бессмысленно.");
        }

        if (target.id === interaction.user.id) {
            return error(interaction, "Нельзя ограбить себя.");
        }

        const settings = interaction.guild
            ? await economy.getGuildSettings(interaction.guild.id)
            : { robMin: 50 };
        const robMin = settings.robMin || 50;
        const victim = await economy.getUser(target.id);

        if (victim.balance < robMin) {
            return error(interaction, `Мало наличных (нужно от **${robMin}**). Банк не украсть.`);
        }

        const success = Math.random() < 0.35;
        const steal = Math.max(robMin, Math.floor(victim.balance * (integer(15, 35) / 100)));
        const fine = integer(80, 180);

        const result = await economy.attemptRob(
            interaction.user.id,
            target.id,
            COOLDOWN,
            success,
            steal,
            fine,
            robMin
        );

        if (!result.ok && result.reason === "cooldown") {
            return error(interaction, `Подожди ${formatDuration(result.nextAt - Date.now())}.`);
        }

        if (!result.ok) {
            return error(interaction, "Нечего брать.");
        }

        if (result.success) {
            const levelUp = result.leveled ? `\nУровень **${result.level}**` : "";
            return reply(interaction, {
                color: COLOR.green,
                description: `${interaction.user} украл **${result.amount}** у ${target}${levelUp}`
            });
        }

        if (result.wiped) {
            return reply(interaction, {
                color: COLOR.red,
                description: `${interaction.user} попался на ${target}. Забрали все наличные.`
            });
        }

        return reply(interaction, {
            color: COLOR.red,
            description: `${interaction.user} попался. ${target} получил **${result.amount}**`
        });
    }
};
