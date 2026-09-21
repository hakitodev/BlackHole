const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { remaining, hit, formatSeconds } = require("../Utils/cooldown");

async function resolveTarget(interaction) {
    const selected = interaction.options.getUser("user");
    if (selected) {
        return selected;
    }

    const rawId = interaction.options.getString("id")?.trim();
    if (!rawId) {
        return null;
    }

    if (!/^\d{17,20}$/.test(rawId)) {
        return false;
    }

    return interaction.client.users.fetch(rawId).catch(() => false);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pay")
        .setDescription("Перевести деньги. Кошелёк общий на все серверы")
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Сумма")
                .setRequired(true)
                .setMinValue(1)
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Получатель на этом сервере")
        )
        .addStringOption(option =>
            option
                .setName("id")
                .setDescription("Discord ID, если человека нет на этом сервере")
        ),

    async execute(interaction) {
        const target = await resolveTarget(interaction);

        if (target === false) {
            return interaction.reply({
                content: "Неверный ID или пользователь не найден.",
                ephemeral: true
            });
        }

        if (!target) {
            return interaction.reply({
                content: "Укажи пользователя или его Discord ID.",
                ephemeral: true
            });
        }

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
                content: "Недостаточно наличных. Деньги в банке сначала сними через /with.",
                ephemeral: true
            });
        }

        await interaction.reply(
            `${interaction.user} перевёл **${amount}** монет ${target}. Баланс общий на всех серверах.`
        );
    }
};
