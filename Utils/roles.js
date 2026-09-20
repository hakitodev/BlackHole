const { PermissionFlagsBits } = require("discord.js");

const DANGEROUS_PERMISSIONS = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.MentionEveryone,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.ManageNicknames,
    PermissionFlagsBits.ModerateMembers
];

function roleError(role, member, me) {
    if (!role) {
        return "Роль не найдена.";
    }

    if (role.id === role.guild.id) {
        return "Нельзя выдавать @everyone.";
    }

    if (role.managed) {
        return "Эту роль выдаёт интеграция, бот не может её назначить.";
    }

    if (DANGEROUS_PERMISSIONS.some(permission => role.permissions.has(permission))) {
        return "Нельзя выдавать роль с опасными правами.";
    }

    if (!me) {
        return "Бот не найден на сервере.";
    }

    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return "У бота нет права Manage Roles.";
    }

    if (me.roles.highest.comparePositionTo(role) <= 0) {
        return "Эта роль выше или равна роли бота.";
    }

    if (
        member.id !== member.guild.ownerId &&
        member.roles.highest.comparePositionTo(role) <= 0
    ) {
        return "Эта роль выше или равна твоей.";
    }

    return null;
}

module.exports = {
    DANGEROUS_PERMISSIONS,
    roleError
};
