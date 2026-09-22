const { SlashCommandBuilder } = require("discord.js");
const { pick } = require("../Utils/random");
const { reply, error } = require("../Utils/reply");

const ANSWERS = [
    "Да.",
    "Нет.",
    "Скорее да.",
    "Скорее нет.",
    "Возможно.",
    "Не сейчас.",
    "Точно.",
    "Сомнительно.",
    "Спроси позже.",
    "Лучше не надо."
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("8ball")
        .setDescription("Магический шар")
        .addStringOption(option =>
            option
                .setName("question")
                .setDescription("Вопрос")
                .setRequired(true)
                .setMaxLength(200)
        ),

    async execute(interaction) {
        const question = interaction.options.getString("question");
        if (!question) {
            return error(interaction, "Задай вопрос.");
        }

        return reply(interaction, {
            description: `**${question}**\n${pick(ANSWERS)}`
        });
    }
};
