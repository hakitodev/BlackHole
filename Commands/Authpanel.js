const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require("discord.js");
const { roleError } = require("../Utils/roles");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("authpanel")
        .setDescription("Создать панель выдачи роли")
        .addRoleOption(option =>
            option
                .setName("role")
                .setDescription("Роль, которую получит пользователь")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .setDMPermission(false),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: "Команду можно использовать только на сервере.",
                ephemeral: true
            });
        }

        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({
                content: "Нужно право Manage Roles.",
                ephemeral: true
            });
        }

        const role = interaction.options.getRole("role");
        const error = roleError(role, interaction.member, interaction.guild.members.me);

        if (error) {
            return interaction.reply({
                content: error,
                ephemeral: true
            });
        }

        const button = new ButtonBuilder()
            .setCustomId(`auth_${role.id}`)
            .setLabel("Получить доступ")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("🍀");

        const row = new ActionRowBuilder().addComponents(button);

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("Авторизация")
            .setDescription(
                `Нажми кнопку ниже, чтобы получить роль ${role}.\nClick the button below to get access.`
            );

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    }
};
