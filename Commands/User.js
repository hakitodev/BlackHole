const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function stamp(date) {
    const unix = Math.floor(date.getTime() / 1000);
    return `<t:${unix}:D> (<t:${unix}:R>)`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("user")
        .setDescription("Информация о пользователе")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь. Или ответь на сообщение")
        ),

    async execute(interaction) {
        const user = interaction.options.getUser("user") ?? interaction.user;
        const member = interaction.guild
            ? await interaction.guild.members.fetch(user.id).catch(() => null)
            : null;

        const embed = new EmbedBuilder()
            .setColor(member?.displayColor || 0x5865F2)
            .setTitle(user.username)
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: "ID", value: user.id, inline: true },
                { name: "Аккаунт", value: stamp(user.createdAt), inline: true }
            );

        if (member?.joinedAt) {
            embed.addFields({ name: "На сервере", value: stamp(member.joinedAt), inline: true });
        }

        if (member) {
            const roles = member.roles.cache
                .filter(role => role.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(role => role.toString())
                .slice(0, 15);

            embed.addFields({
                name: `Роли (${member.roles.cache.size - 1})`,
                value: roles.join(" ") || "Нет"
            });
        }

        await interaction.reply({ embeds: [embed] });
    }
};
