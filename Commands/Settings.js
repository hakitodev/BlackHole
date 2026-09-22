const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { PUBLIC_URL } = require("../Config");
const economy = require("../Database/Economy");
const { reply, error } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("settings")
        .setDescription("Настройки сервера")
        .addSubcommand(sub =>
            sub
                .setName("prefix")
                .setDescription("Префикс-команды на этом сервере")
                .addStringOption(option =>
                    option
                        .setName("mode")
                        .setDescription("slash — только слэш, prefix — и префикс")
                        .setRequired(true)
                        .addChoices(
                            { name: "Только слэш", value: "slash" },
                            { name: "Префикс и слэш", value: "prefix" }
                        )
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),
    aliases: ["config"],

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return error(interaction, "Только на сервере.");
        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return error(interaction, "Нужно право Manage Server.");
        }

        const sub = interaction.options.getSubcommand();
        if (sub !== "prefix") {
            return error(interaction, "Неизвестная настройка.");
        }

        const enabled = interaction.options.getString("mode") === "prefix";
        await economy.setPrefixEnabled(interaction.guild.id, enabled);

        let description = enabled
            ? "Префикс-команды включены."
            : "Только слэш-команды.";

        if (PUBLIC_URL) {
            description += `\nСайт: ${PUBLIC_URL}/servers/${interaction.guild.id}`;
        }

        return reply(interaction, { description });
    }
};
