const { PermissionFlagsBits } = require("discord.js");
const { DANGEROUS_PERMISSIONS } = require("../Utils/roles");

module.exports = {
    id: "auth",

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: "Кнопка работает только на сервере.",
                ephemeral: true
            });
        }

        const roleId = interaction.customId.split("_")[1];
        const role = interaction.guild.roles.cache.get(roleId)
            ?? await interaction.guild.roles.fetch(roleId).catch(() => null);

        if (!role || role.id === interaction.guild.id || role.managed) {
            return interaction.reply({
                content: "Роль больше недоступна.",
                ephemeral: true
            });
        }

        if (DANGEROUS_PERMISSIONS.some(permission => role.permissions.has(permission))) {
            return interaction.reply({
                content: "Эту роль нельзя выдать через панель.",
                ephemeral: true
            });
        }

        const me = interaction.guild.members.me;

        if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)
            || me.roles.highest.comparePositionTo(role) <= 0) {
            return interaction.reply({
                content: "Бот не может выдать эту роль. Проверь права и иерархию.",
                ephemeral: true
            });
        }

        if (interaction.member.roles.cache.has(role.id)) {
            return interaction.reply({
                content: "У тебя уже есть эта роль.",
                ephemeral: true
            });
        }

        try {
            await interaction.member.roles.add(role, "Auth panel");
        } catch {
            return interaction.reply({
                content: "Не удалось выдать роль. Проверь права бота.",
                ephemeral: true
            });
        }

        return interaction.reply({
            content: `Готово. Ты получил роль ${role}.`,
            ephemeral: true
        });
    }
};
