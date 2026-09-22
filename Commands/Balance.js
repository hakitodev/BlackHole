const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { editReply, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bal")
        .setDescription("Баланс")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь или ответ на сообщение")
        ),
    aliases: ["balance", "money", "wallet"],

    async execute(interaction) {
        await interaction.deferReply();

        const member = interaction.options.getUser("user") ?? interaction.user;
        const user = await economy.getUser(member.id);

        return editReply(interaction, {
            color: COLOR.gold,
            title: member.username,
            description:
                `Наличные: **${user.balance}**\n` +
                `Банк: **${user.bank}**\n` +
                `Всего: **${user.balance + user.bank}**`
        });
    }
};
