const { SlashCommandBuilder } = require("discord.js");
const { runCollect, formatCollect } = require("../Utils/collect");
const { isDisabled } = require("../Utils/commands");
const { forInteraction } = require("../Utils/scope");
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

        const { scope, settings } = await forInteraction(interaction);

        if (isDisabled(settings, kind)) {
            return error(interaction, `\`${kind}\` выключен на этом сервере.`);
        }

        const result = await runCollect(interaction.user.id, kind, { settings, scope });
        return reply(interaction, {
            title: "Сбор",
            color: result.claimed ? COLOR.gold : COLOR.blurple,
            description: formatCollect(result),
            ephemeral: !result.claimed
        });
    }
};
