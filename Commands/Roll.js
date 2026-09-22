const { SlashCommandBuilder } = require("discord.js");
const { integer } = require("../Utils/random");
const { reply } = require("../Utils/reply");

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
        return reply(interaction, {
            description: `**${integer(1, max)}** / ${max}`
        });
    }
};
