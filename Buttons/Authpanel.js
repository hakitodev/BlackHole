const { PermissionFlagsBits } = require("discord.js");
const { DANGEROUS_PERMISSIONS } = require("../Utils/roles");
const { reply, error, COLOR } = require("../Utils/reply");

module.exports = {
    id: "auth",

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return error(interaction, "Только на сервере.");
        }

        const roleId = interaction.customId.split("_")[1];
        const role = interaction.guild.roles.cache.get(roleId)
            ?? await interaction.guild.roles.fetch(roleId).catch(() => null);

        if (!role || role.id === interaction.guild.id || role.managed) {
            return error(interaction, "Роль недоступна.");
        }

        if (DANGEROUS_PERMISSIONS.some(permission => role.permissions.has(permission))) {
            return error(interaction, "Эту роль нельзя выдать так.");
        }

        const me = interaction.guild.members.me;

        if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)
            || me.roles.highest.comparePositionTo(role) <= 0) {
            return error(interaction, "Бот не может выдать эту роль.");
        }

        if (interaction.member.roles.cache.has(role.id)) {
            return error(interaction, "У тебя уже есть эта роль.");
        }

        try {
            await interaction.member.roles.add(role, "Auth panel");
        } catch {
            return error(interaction, "Не удалось выдать роль.");
        }

        return reply(interaction, {
            color: COLOR.green,
            description: `Роль ${role}.`,
            ephemeral: true
        });
    }
};
