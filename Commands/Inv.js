const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { get, format } = require("../Utils/shop");
const { forInteraction } = require("../Utils/scope");
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
        const { scope } = await forInteraction(interaction);
        const rows = await economy.getInventory(member.id, scope);

        if (!rows.length) {
            return error(
                interaction,
                member.id === interaction.user.id
                    ? "Пусто."
                    : `У **${member.username}** пусто.`
            );
        }

        const lines = [];
        for (const row of rows) {
            const item = await get(row.item_id, interaction.guildId);
            const label = item ? format(item) : row.item_id;
            lines.push(`${label} — **${row.qty}**`);
        }

        return reply(interaction, {
            color: COLOR.pink,
            title: member.username,
            description: lines.join("\n")
        });
    }
};
