const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { remaining, hit, formatSeconds } = require("../Utils/cooldown");

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
                .setMinValue(1)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");

        if (target.bot) {
            return interaction.reply({
                content: "Нельзя переводить ботам.",
                ephemeral: true
            });
        }

        if (target.id === interaction.user.id) {
            return interaction.reply({
                content: "Нельзя перевести деньги самому себе.",
                ephemeral: true
            });
        }

        const key = `pay:${interaction.user.id}`;
        const wait = remaining(key);

        if (wait) {
            return interaction.reply({
                content: `Подожди ${formatSeconds(wait)} сек.`,
                ephemeral: true
            });
        }

        hit(key, 3000);

        const result = await economy.transfer(
            interaction.user.id,
            target.id,
            amount
        );

        if (!result.ok) {
            return interaction.reply({
                content: "Недостаточно средств.",
                ephemeral: true
            });
        }

        await interaction.reply(
            `${interaction.user} перевёл **${amount}** монет ${target}.`
        );
    }
};
