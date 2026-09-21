const { SlashCommandBuilder } = require("discord.js");
const { integer } = require("../Utils/random");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("roll")
        .setDescription("Случайное число")
        .addIntegerOption(option =>
            option
                .setName("max")
                .setDescription("Максимум")
                .setMinValue(2)
                .setMaxValue(1000000)
        ),

    async execute(interaction) {
        const max = interaction.options.getInteger("max") ?? 6;
        await interaction.reply(`Выпало **${integer(1, max)}** из ${max}`);
    }
};
