const { SlashCommandBuilder } = require("discord.js");
const { pick } = require("../Utils/random");
const { reply, error } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pick")
        .setDescription("Выбрать вариант через запятую")
        .addStringOption(option =>
            option
                .setName("options")
                .setDescription("чай, кофе, какао")
                .setRequired(true)
                .setMaxLength(300)
        ),

    async execute(interaction) {
        const options = (interaction.options.getString("options") ?? "")
            .split(",")
            .map(part => part.trim())
            .filter(Boolean);

        if (options.length < 2) {
            return error(interaction, "Нужно хотя бы два варианта через запятую.");
        }

        return reply(interaction, {
            description: `**${pick(options)}**`
        });
    }
};
