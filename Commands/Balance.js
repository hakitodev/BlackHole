const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bal")
        .setDescription("Баланс.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь. Или ответь на сообщение")
        ),
    aliases: ["balance", "money", "wallet"],

    async execute(interaction) {
        await interaction.deferReply();

        const member = interaction.options.getUser("user") ?? interaction.user;
        const user = await economy.getUser(member.id);

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle("Баланс")
            .setDescription(
                `**${member.username}**\n` +
                `Наличные: **${user.balance}**\n` +
                `Банк: **${user.bank}**\n` +
                `Всего: **${user.balance + user.bank}**`
            );

        await interaction.editReply({ embeds: [embed] });
    }
};
