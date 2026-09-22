const { SlashCommandBuilder } = require("discord.js");
const profile = require("./Profile");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Профиль")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь или ответ на сообщение")
        ),
    execute: (...args) => profile.execute(...args)
};
