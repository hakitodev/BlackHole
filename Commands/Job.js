const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { JOBS, mergeJobs, getJobFrom, jobByQueryFrom } = require("../Utils/jobs");
const { forInteraction } = require("../Utils/scope");
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
        const { scope, settings } = await forInteraction(interaction);
        if (settings.jobsGlobal === false && !settings.jobsGuild) {
            return error(interaction, "Работы выключены.");
        }
        const local = settings.jobsGuild && interaction.guildId
            ? await economy.listCatalog(interaction.guildId, "job")
            : [];
        const jobs = mergeJobs(settings.jobsGlobal !== false, local);
        const penalty = await economy.applyIdlePenalties(interaction.user.id, scope, settings);
        const user = await economy.getUser(interaction.user.id, scope);
        const current = getJobFrom(jobs.length ? jobs : JOBS, user.job);

        if (sub === "take") {
            const job = jobByQueryFrom(jobs, interaction.options.getString("name"));
            if (!job) {
                return error(interaction, "Нет такой профессии.");
            }
            if (user.level < job.minLevel) {
                return error(interaction, `Нужен **${job.minLevel}** уровень.`);
            }
            await economy.setJob(interaction.user.id, job.id, scope);
            return reply(interaction, {
                color: COLOR.green,
                description: `Теперь **${job.name}**. Work платит ×**${job.mult}**.`
            });
        }

        if (sub === "quit") {
            await economy.setJob(interaction.user.id, "intern", scope);
            return reply(interaction, {
                color: COLOR.blurple,
                description: "Снова стажёр."
            });
        }

        const fired = penalty.fired ? "Уволен за простой.\n" : "";
        const lines = jobs.map(job => {
            const mark = current.id === job.id ? " ← ты" : "";
            const lock = user.level < job.minLevel ? " 🔒" : "";
            return `**${job.name}** · ур. ${job.minLevel} · ×${job.mult}${lock}${mark}`;
        });

        return reply(interaction, {
            color: COLOR.blurple,
            title: "Профессии",
            description: fired + (lines.join("\n") || "Пусто.")
        });
    }
};
