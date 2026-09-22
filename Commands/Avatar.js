const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("Аватар пользователя")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь. Или ответь на сообщение")
        ),

    async execute(interaction) {
        const user = interaction.options.getUser("user") ?? interaction.user;
        const url = user.displayAvatarURL({ size: 4096 });

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(user.username)
            .setImage(url)
            .setURL(url);

        await interaction.reply({ embeds: [embed] });
    }
};
