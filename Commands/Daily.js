const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");

const REWARD = 500;
const COOLDOWN = 24 * 60 * 60 * 1000;

module.exports = {

    data: new SlashCommandBuilder()
        .setName("daily")
        .setDescription("Получить ежедневную награду"),

    async execute(interaction) {

        const user = await economy.getUser(interaction.user.id);

        const now = Date.now();

        if (now - user.daily < COOLDOWN) {

            const hours = Math.ceil(
                (COOLDOWN - (now - user.daily)) / 3600000
            );

            return interaction.reply({
                content: `Следующая награда через ${hours} ч.`,
                ephemeral: true
            });

        }

        await economy.addBalance(interaction.user.id, REWARD);
        await economy.setDaily(interaction.user.id, now);

        interaction.reply({
            content: `💰 Ты получил **${REWARD}** монет!`
        });

    }

};
