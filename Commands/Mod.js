const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { isOwner, requireOwner, isStaff } = require("../Utils/staff");
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
                description: rows.map((row, index) => `**${index + 1}.** <@${row.user_id}>`).join("\n"),
                ephemeral: true
            });
        }

        if (!(await requireOwner(interaction))) {
            return;
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

            const added = await economy.addStaff(target.id, interaction.user.id);

            return reply(interaction, {
                color: COLOR.green,
                description: added
                    ? `${target} теперь модератор.`
                    : `${target} уже модератор.`,
                ephemeral: true
            });
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
