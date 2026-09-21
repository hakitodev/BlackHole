const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { isOwner } = require("../Utils/staff");

function bar(xp, need) {
    const size = 10;
    const filled = Math.max(0, Math.min(size, Math.round((xp / need) * size)));
    return "█".repeat(filled) + "░".repeat(size - filled);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profile")
        .setDescription("Профиль. Деньги и уровень общие на все серверы")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь")
        ),

    async execute(interaction) {
        const member = interaction.options.getUser("user") ?? interaction.user;
        const user = await economy.getUser(member.id);
        const need = economy.neededXp(user.level);
        const role = isOwner({ client: interaction.client, user: member })
            ? "Владелец бота"
            : await economy.isStaff(member.id)
                ? "Модератор экономики"
                : null;

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(member.username)
            .setThumbnail(member.displayAvatarURL({ size: 256 }))
            .addFields(
                {
                    name: "Деньги",
                    value: `Наличные: **${user.balance}**\nБанк: **${user.bank}**\nВсего: **${user.balance + user.bank}**`,
                    inline: true
                },
                {
                    name: "Прогресс",
                    value: `Уровень **${user.level}**\n${bar(user.xp, need)} ${user.xp}/${need} XP`,
                    inline: true
                }
            )
            .setFooter({ text: "Один кошелёк и уровень на все серверы бота" });

        if (role) {
            embed.addFields({ name: "Статус", value: role, inline: true });
        }

        await interaction.reply({ embeds: [embed] });
    }
};
