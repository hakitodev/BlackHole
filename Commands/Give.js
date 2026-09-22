const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { requireStaff } = require("../Utils/staff");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("give")
        .setDescription("Выдать монеты. Общий кошелёк на все серверы")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Получатель. Или ответь на сообщение")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Сумма")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1000000)
        ),

    async execute(interaction) {
        if (!(await requireStaff(interaction))) {
            return;
        }

        const target = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");

        if (!target) {
            return interaction.reply({
                content: "Укажи пользователя или ответь на его сообщение.",
                ephemeral: true
            });
        }

        if (!Number.isInteger(amount) || amount < 1) {
            return interaction.reply({
                content: "Укажи сумму.",
                ephemeral: true
            });
        }

        if (target.bot) {
            return interaction.reply({
                content: "Нельзя выдавать монеты ботам.",
                ephemeral: true
            });
        }

        await economy.addBalance(target.id, amount);

        await interaction.reply(
            `${interaction.user} выдал ${target} **${amount}** монет. Баланс общий на всех серверах.`
        );
    }
};
