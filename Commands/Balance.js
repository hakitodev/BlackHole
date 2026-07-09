const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bal")
        .setDescription("See balance")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("User")
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
