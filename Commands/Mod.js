const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { isOwner, requireOwner, RANK, rankLabel, isSenior, guildAccess } = require("../Utils/staff");
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
            const access = await guildAccess(interaction.user.id, interaction.guild, interaction.client);
            if (access.rank < RANK.mod) {
                return error(interaction, "Нужно быть владельцем или модератором.");
            }

            const global = access.global ? await economy.listStaff() : [];
            const local = interaction.guild
                ? await economy.listGuildStaff(interaction.guild.id)
                : [];
            if (!global.length && !local.length) {
                return error(interaction, "Модераторов нет.");
            }

            const lines = [];
            if (global.length) {
                lines.push("**Всемирные**");
                for (const [index, row] of global.entries()) {
                    lines.push(`**${index + 1}.** <@${row.user_id}> — ${rankLabel(Number(row.rank) || 1)}`);
                }
            }
            if (local.length) {
                lines.push("**Сервер**");
                for (const [index, row] of local.entries()) {
                    lines.push(`**${index + 1}.** <@${row.user_id}> — серверный модер`);
                }
            }

            return reply(interaction, {
                title: "Модераторы",
                description: lines.join("\n"),
                ephemeral: true
            });
        }

        const access = await guildAccess(interaction.user.id, interaction.guild, interaction.client);
        if (!access.global && !access.guildOwner) {
            return error(interaction, "Назначать модеров может владелец сервера или высший модер бота.");
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

            if (!access.global) {
                if (!interaction.guild) {
                    return error(interaction, "Локальных модеров только на сервере.");
                }
                if (wanted >= RANK.senior) {
                    return error(interaction, "Серверный модер не выдаёт всемирный ранг.");
                }
                const result = await economy.addGuildStaff(
                    interaction.guild.id,
                    target.id,
                    interaction.user.id,
                    RANK.mod
                );
                return reply(interaction, {
                    color: COLOR.green,
                    description: result.created
                        ? `${target} теперь серверный модер.`
                        : `${target} уже серверный модер.`,
                    ephemeral: true
                });
            }

            if (wanted >= RANK.senior && !(await requireOwner(interaction))) {
                return;
            }

            const result = await economy.addStaff(target.id, interaction.user.id, wanted);

            return reply(interaction, {
                color: COLOR.green,
                description: `${target} теперь ${rankLabel(result.rank)}.`,
                ephemeral: true
            });
        }

        if (!access.global) {
            const removed = await economy.removeGuildStaff(interaction.guild.id, target.id);
            return reply(interaction, {
                description: removed
                    ? `${target} больше не серверный модер.`
                    : `${target} не был модератором.`,
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
