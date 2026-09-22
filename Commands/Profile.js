const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { isOwner } = require("../Utils/staff");
const { reply, COLOR } = require("../Utils/reply");

function bar(xp, need) {
    const size = 10;
    const filled = Math.max(0, Math.min(size, Math.round((xp / need) * size)));
    return "█".repeat(filled) + "░".repeat(size - filled);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profile")
        .setDescription("Профиль")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь или ответ на сообщение")
        ),

    async execute(interaction) {
        const member = interaction.options.getUser("user") ?? interaction.user;
        const user = await economy.getUser(member.id);
        const need = economy.neededXp(user.level);
        const role = isOwner({ client: interaction.client, user: member })
            ? "Владелец"
            : await economy.isStaff(member.id)
                ? "Модер"
                : null;

        const fields = [
            {
                name: "Деньги",
                value: `Наличные: **${user.balance}**\nБанк: **${user.bank}**\nВсего: **${user.balance + user.bank}**`,
                inline: true
            },
            {
                name: "Уровень",
                value: `**${user.level}**\n${bar(user.xp, need)} ${user.xp}/${need}`,
                inline: true
            }
        ];

        if (role) {
            fields.push({ name: "Статус", value: role, inline: true });
        }

        return reply(interaction, {
            color: COLOR.blurple,
            title: member.username,
            thumbnail: member.displayAvatarURL({ size: 256 }),
            fields
        });
    }
};
