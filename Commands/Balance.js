const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bal")
        .setDescription("Показать баланс")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь")
        ),

    async execute(interaction) {
        const member = interaction.options.getUser("user") ?? interaction.user;
        const user = await economy.getUser(member.id);
        const total = user.balance + user.bank;

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle("Баланс")
            .setDescription(
                `**${member.username}**\n` +
                `Наличные: **${user.balance}**\n` +
                `Банк: **${user.bank}**\n` +
                `Всего: **${total}**`
            );

        await interaction.reply({ embeds: [embed] });
    }
};
