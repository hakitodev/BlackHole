const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { get, format } = require("../Utils/shop");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("inv")
        .setDescription("Инвентарь")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь. Или ответь на сообщение")
        ),

    async execute(interaction) {
        const member = interaction.options.getUser("user") ?? interaction.user;
        const rows = await economy.getInventory(member.id);

        if (!rows.length) {
            return interaction.reply({
                content: member.id === interaction.user.id
                    ? "Инвентарь пуст. Загляни в /shop."
                    : `У **${member.username}** пустой инвентарь.`,
                ephemeral: true
            });
        }

        const lines = rows.map(row => {
            const item = get(row.item_id);
            const label = item ? format(item) : row.item_id;
            return `${label} — **${row.qty}**`;
        });

        const embed = new EmbedBuilder()
            .setColor(0xEB459E)
            .setTitle(`Инвентарь ${member.username}`)
            .setDescription(lines.join("\n"));

        await interaction.reply({ embeds: [embed] });
    }
};
