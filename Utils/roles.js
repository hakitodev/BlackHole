const { PermissionFlagsBits } = require("discord.js");

function roleError(role, member, me) {
    if (!role) {
        return "Роль не найдена.";
    }

    if (role.id === role.guild.id) {
        return "Нельзя выдавать @everyone.";
    }

    if (role.managed) {
        return "Эту роль выдаёт интеграция.";
    }

    if (!me) {
        return "Бот не найден на сервере.";
    }

    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return "У меня нет права Manage Roles.";
    }

    if (me.roles.highest.comparePositionTo(role) <= 0) {
        return "Эта роль выше или равна моей. Подними роль бота.";
    }

    return null;
}

module.exports = {
    roleError
};
