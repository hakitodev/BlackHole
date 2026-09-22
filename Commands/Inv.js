const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { get, format } = require("../Utils/shop");
const { reply, error, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("inv")
        .setDescription("Инвентарь")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь или ответ на сообщение")
        ),

    async execute(interaction) {
        const member = interaction.options.getUser("user") ?? interaction.user;
        const rows = await economy.getInventory(member.id);

        if (!rows.length) {
            return error(
                interaction,
                member.id === interaction.user.id
                    ? "Пусто."
                    : `У **${member.username}** пусто.`
            );
        }

        const lines = rows.map(row => {
            const item = get(row.item_id);
            const label = item ? format(item) : row.item_id;
            return `${label} — **${row.qty}**`;
        });

        return reply(interaction, {
            color: COLOR.pink,
            title: member.username,
            description: lines.join("\n")
        });
    }
};
