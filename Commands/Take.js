const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { requireStaff } = require("../Utils/staff");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("take")
        .setDescription("Забрать монеты. Сначала наличные, потом банк")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("У кого забрать. Или ответь на сообщение")
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
                content: "У ботов нет кошелька.",
                ephemeral: true
            });
        }

        const result = await economy.takeBalance(target.id, amount);

        if (!result.ok) {
            return interaction.reply({
                content: `Недостаточно денег. Всего у ${target}: **${result.total}**.`,
                ephemeral: true
            });
        }

        await interaction.reply(
            `${interaction.user} забрал у ${target} **${result.amount}** монет.`
        );
    }
};
