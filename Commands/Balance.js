const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("balance")
        .setDescription("Посмотреть баланс")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь")
        ),
    async execute(interaction) {
        const member =
            interaction.options.getUser("user") ??
            interaction.user;
        const user = await economy.getUser(member.id);
        const embed = new EmbedBuilder()
            .setTitle("💰 Баланс")
            .setDescription(
`**${member.username}**
Наличные: **${user.balance}**
Банк: **${user.bank}**`
            );
        await interaction.reply({
            embeds: [embed]
        });
    }
};
