const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { runCollect, formatCollect } = require("../Utils/collect");
const { isDisabled } = require("../Utils/commands");
const { reply, error, COLOR } = require("../Utils/reply");

const KINDS = new Set(["daily", "work", "crime"]);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("collect")
        .setDescription("Сбор")
        .addSubcommand(sub => sub.setName("daily").setDescription("Ежедневка"))
        .addSubcommand(sub => sub.setName("work").setDescription("Работа"))
        .addSubcommand(sub => sub.setName("crime").setDescription("Преступление")),
    aliases: ["col"],

    async execute(interaction) {
        const kind = interaction.options.getSubcommand(false);
        if (!KINDS.has(kind)) {
            return error(interaction, "Укажи `daily`, `work` или `crime`.");
        }

        const settings = interaction.guild
            ? await economy.getGuildSettings(interaction.guild.id)
            : {};

        if (isDisabled(settings, kind)) {
            return error(interaction, `\`${kind}\` выключен на этом сервере.`);
        }

        const result = await runCollect(interaction.user.id, kind, { settings });
        return reply(interaction, {
            title: "Сбор",
            color: result.claimed ? COLOR.gold : COLOR.blurple,
            description: formatCollect(result),
            ephemeral: !result.claimed
        });
    }
};
