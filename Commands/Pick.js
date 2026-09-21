const { SlashCommandBuilder } = require("discord.js");
const { pick } = require("../Utils/random");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pick")
        .setDescription("Выбрать один вариант через запятую")
        .addStringOption(option =>
            option
                .setName("options")
                .setDescription("Например: чай, кофе, какао")
                .setRequired(true)
                .setMaxLength(300)
        ),

    async execute(interaction) {
        const options = interaction.options.getString("options")
            .split(",")
            .map(part => part.trim())
            .filter(Boolean);

        if (options.length < 2) {
            return interaction.reply({
                content: "Нужно хотя бы два варианта через запятую.",
                ephemeral: true
            });
        }

        await interaction.reply(`Выбираю: **${pick(options)}**`);
    }
};
