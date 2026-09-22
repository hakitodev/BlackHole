const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { JOBS, jobByQuery, getJob } = require("../Utils/jobs");
const { reply, error, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("job")
        .setDescription("Профессия")
        .addSubcommand(sub => sub.setName("list").setDescription("Список"))
        .addSubcommand(sub =>
            sub
                .setName("take")
                .setDescription("Устроиться")
                .addStringOption(option =>
                    option.setName("name").setDescription("Профессия").setRequired(true)
                )
        )
        .addSubcommand(sub => sub.setName("quit").setDescription("Уволиться")),
    aliases: ["workjob", "профессия"],

    async execute(interaction) {
        const sub = interaction.options.getSubcommand(false) || "list";
        const user = await economy.getUser(interaction.user.id);
        const current = getJob(user.job);

        if (sub === "take") {
            const job = jobByQuery(interaction.options.getString("name"));
            if (!job) {
                return error(interaction, "Нет такой профессии.");
            }
            if (user.level < job.minLevel) {
                return error(interaction, `Нужен **${job.minLevel}** уровень.`);
            }
            await economy.setJob(interaction.user.id, job.id);
            return reply(interaction, {
                color: COLOR.green,
                description: `Теперь **${job.name}**. Work платит ×**${job.mult}**.`
            });
        }

        if (sub === "quit") {
            await economy.setJob(interaction.user.id, "intern");
            return reply(interaction, {
                color: COLOR.blurple,
                description: "Снова стажёр."
            });
        }

        const lines = JOBS.map(job => {
            const mark = current.id === job.id ? " ← ты" : "";
            const lock = user.level < job.minLevel ? " 🔒" : "";
            return `**${job.name}** · ур. ${job.minLevel} · ×${job.mult}${lock}${mark}`;
        });

        return reply(interaction, {
            color: COLOR.blurple,
            title: "Профессии",
            description: lines.join("\n")
        });
    }
};
