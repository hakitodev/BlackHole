const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
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

        return reply(interaction, {
            description: enabled
                ? "Префикс-команды включены."
                : "Только слэш-команды."
        });
    }
};
