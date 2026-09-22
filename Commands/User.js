const { SlashCommandBuilder } = require("discord.js");
const { reply, COLOR } = require("../Utils/reply");

function stamp(date) {
    const unix = Math.floor(date.getTime() / 1000);
    return `<t:${unix}:D> (<t:${unix}:R>)`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("user")
        .setDescription("Пользователь")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь или ответ на сообщение")
        ),

    async execute(interaction) {
        const user = interaction.options.getUser("user") ?? interaction.user;
        const member = interaction.guild
            ? await interaction.guild.members.fetch(user.id).catch(() => null)
            : null;

        const fields = [
            { name: "ID", value: user.id, inline: true },
            { name: "Аккаунт", value: stamp(user.createdAt), inline: true }
        ];

        if (member?.joinedAt) {
            fields.push({ name: "Зашёл", value: stamp(member.joinedAt), inline: true });
        }

        if (member) {
            const roles = member.roles.cache
                .filter(role => role.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(role => role.toString())
                .slice(0, 15);

            fields.push({
                name: `Роли (${member.roles.cache.size - 1})`,
                value: roles.join(" ") || "—"
            });
        }

        return reply(interaction, {
            color: member?.displayColor || COLOR.blurple,
            title: user.username,
            thumbnail: user.displayAvatarURL({ size: 256 }),
            fields
        });
    }
};
