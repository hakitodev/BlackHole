const { SlashCommandBuilder } = require("discord.js");
const { reply, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("Аватар")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь или ответ на сообщение")
        ),

    async execute(interaction) {
        const user = interaction.options.getUser("user") ?? interaction.user;
        const url = user.displayAvatarURL({ size: 4096 });

        return reply(interaction, {
            color: COLOR.blurple,
            title: user.username,
            image: url,
            url
        });
    }
};
