const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { isOwner, requireOwner, isStaff, getRank, RANK, rankLabel, isSenior } = require("../Utils/staff");
const { reply, error, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("mod")
        .setDescription("Модераторы")
        .addSubcommand(sub =>
            sub
                .setName("add")
                .setDescription("Назначить")
                .addUserOption(option =>
                    option
                        .setName("user")
                        .setDescription("Кого назначить")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("rank")
                        .setDescription("Уровень")
                        .addChoices(
                            { name: "Модератор", value: "mod" },
                            { name: "Высший модератор", value: "senior" }
                        )
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("remove")
                .setDescription("Снять")
                .addUserOption(option =>
                    option
                        .setName("user")
                        .setDescription("Кого снять")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("list")
                .setDescription("Список")
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (!sub) {
            return error(interaction, "add, remove или list.");
        }

        if (sub === "list") {
            if (!(await isStaff(interaction))) {
                return error(interaction, "Нужно быть владельцем или модератором.");
            }

            const rows = await economy.listStaff();
            if (!rows.length) {
                return error(interaction, "Модераторов нет.");
            }

            return reply(interaction, {
                title: "Модераторы",
                description: rows.map((row, index) =>
                    `**${index + 1}.** <@${row.user_id}> — ${rankLabel(Number(row.rank) || 1)}`
                ).join("\n"),
                ephemeral: true
            });
        }

        const actorRank = await getRank(interaction);
        if (actorRank < RANK.senior) {
            return error(interaction, "Только высший модератор или владелец.");
        }

        const target = interaction.options.getUser("user");

        if (!target) {
            return error(interaction, "Укажи пользователя или ответь на сообщение.");
        }

        if (target.bot) {
            return error(interaction, "Бота нельзя назначить.");
        }

        if (sub === "add") {
            if (isOwner({ client: interaction.client, user: target })) {
                return error(interaction, "Это владелец бота.");
            }

            const wanted = interaction.options.getString("rank") === "senior"
                ? RANK.senior
                : RANK.mod;

            if (wanted >= RANK.senior && !(await requireOwner(interaction))) {
                return;
            }

            const result = await economy.addStaff(target.id, interaction.user.id, wanted);

            return reply(interaction, {
                color: COLOR.green,
                description: result.created
                    ? `${target} теперь ${rankLabel(result.rank)}.`
                    : `${target} теперь ${rankLabel(result.rank)}.`,
                ephemeral: true
            });
        }

        if (!(await isSenior(interaction))) {
            return error(interaction, "Только высший модератор или владелец.");
        }

        const targetRank = await economy.getStaffRank(target.id);
        if (targetRank >= RANK.senior && !isOwner(interaction)) {
            return error(interaction, "Высшего модератора снимает только владелец.");
        }

        const removed = await economy.removeStaff(target.id);

        return reply(interaction, {
            description: removed
                ? `${target} больше не модератор.`
                : `${target} не был модератором.`,
            ephemeral: true
        });
    }
};
