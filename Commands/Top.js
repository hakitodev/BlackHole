const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("top")
        .setDescription("Топ по всем серверам бота")
        .addStringOption(option =>
            option
                .setName("type")
                .setDescription("Категория")
                .addChoices(
                    { name: "Деньги", value: "money" },
                    { name: "Уровень", value: "level" }
                )
        ),

    async execute(interaction) {
        const type = interaction.options.getString("type") ?? "money";
        const users = await economy.getTop(10, type);

        if (!users.length) {
            return interaction.reply({
                content: "Пока некого показывать.",
                ephemeral: true
            });
        }

        const lines = users.map((user, index) => {
            if (type === "level") {
                return `**${index + 1}.** <@${user.id}> — ур. **${user.level}**`;
            }

            const total = (Number(user.balance) || 0) + (Number(user.bank) || 0);
            return `**${index + 1}.** <@${user.id}> — **${total}**`;
        });

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(type === "level" ? "Топ по уровню · все серверы" : "Топ богачей · все серверы")
            .setDescription(lines.join("\n"))
            .setFooter({ text: "Межгильдная экономика" });

        await interaction.reply({ embeds: [embed] });
    }
};
