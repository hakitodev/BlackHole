const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("pay")
        .setDescription("Перевести деньги")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Получатель")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Сумма")
                .setRequired(true)
        ),

    async execute(interaction) {

        const target = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");

        if (amount <= 0)
            return interaction.reply({
                content: "Введите положительную сумму.",
                ephemeral: true
            });

        if (target.bot)
            return interaction.reply({
                content: "Нельзя переводить ботам.",
                ephemeral: true
            });

        if (target.id === interaction.user.id)
            return interaction.reply({
                content: "Нельзя перевести деньги самому себе.",
                ephemeral: true
            });

        const sender = await economy.getUser(interaction.user.id);

        if (sender.balance < amount)
            return interaction.reply({
                content: "Недостаточно средств.",
                ephemeral: true
            });

        await economy.transfer(
            interaction.user.id,
            target.id,
            amount
        );

        interaction.reply(
            `💸 ${interaction.user} перевёл **${amount}** монет ${target}.`
        );

    }

};
