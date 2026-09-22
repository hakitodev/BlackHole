const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require("discord.js");
const { roleError } = require("../Utils/roles");
const { reply, error, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("authpanel")
        .setDescription("Панель выдачи роли")
        .addRoleOption(option =>
            option
                .setName("role")
                .setDescription("Роль")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .setDMPermission(false),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return error(interaction, "Только на сервере.");
        }

        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
            return error(interaction, "Нужно право Manage Roles.");
        }

        const role = interaction.options.getRole("role");
        const problem = roleError(role, interaction.member, interaction.guild.members.me);

        if (problem) {
            return error(interaction, problem);
        }

        const button = new ButtonBuilder()
            .setCustomId(`auth_${role.id}`)
            .setLabel("Получить доступ")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("🍀");

        return reply(interaction, {
            color: COLOR.green,
            title: "Авторизация",
            description: `Нажми, чтобы получить ${role}.`,
            components: [new ActionRowBuilder().addComponents(button)]
        });
    }
};
