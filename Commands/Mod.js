const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { isOwner, requireOwner, isStaff } = require("../Utils/staff");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("mod")
        .setDescription("Модераторы межгильдной экономики")
        .addSubcommand(sub =>
            sub
                .setName("add")
                .setDescription("Назначить модератора")
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
                .setDescription("Снять модератора")
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
                .setDescription("Список модераторов")
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === "list") {
            if (!(await isStaff(interaction))) {
                return interaction.reply({
                    content: "Нужно быть владельцем или модератором экономики.",
                    ephemeral: true
                });
            }

            const rows = await economy.listStaff();
            if (!rows.length) {
                return interaction.reply({
                    content: "Модераторов пока нет. Владелец может добавить через `/mod add`.",
                    ephemeral: true
                });
            }

            const lines = rows.map((row, index) =>
                `**${index + 1}.** <@${row.user_id}>`
            );

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("Модераторы экономики")
                .setDescription(lines.join("\n"))
                .setFooter({ text: "Действуют на всех серверах бота" });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (!(await requireOwner(interaction))) {
            return;
        }

        const target = interaction.options.getUser("user");

        if (target.bot) {
            return interaction.reply({
                content: "Бота нельзя назначить модератором.",
                ephemeral: true
            });
        }

        if (sub === "add") {
            if (isOwner({ client: interaction.client, user: target })) {
                return interaction.reply({
                    content: "Это и так владелец бота.",
                    ephemeral: true
                });
            }

            const added = await economy.addStaff(target.id, interaction.user.id);

            return interaction.reply({
                content: added
                    ? `${target} теперь модератор экономики на всех серверах. Доступны \`/give\` и \`/take\`.`
                    : `${target} уже модератор.`,
                ephemeral: true
            });
        }

        const removed = await economy.removeStaff(target.id);

        await interaction.reply({
            content: removed
                ? `${target} больше не модератор экономики.`
                : `${target} не был модератором.`,
            ephemeral: true
        });
    }
};
