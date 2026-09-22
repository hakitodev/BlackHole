const { payload } = require("./reply");
const economy = require("../Database/Economy");
const { isDisabled } = require("./commands");

async function runCommand(command, interaction) {
    try {
        const name = command.data?.name;
        if (interaction.guild && name) {
            const settings = await economy.getGuildSettings(interaction.guild.id);
            if (isDisabled(settings, name)) {
                const reply = payload({
                    description: `Команда \`/${name}\` выключена на этом сервере.`,
                    color: 0xED4245,
                    ephemeral: true
                });
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply).catch(() => {});
                } else {
                    await interaction.reply(reply).catch(() => {});
                }
                return;
            }
        }

        await command.execute(interaction);
    } catch (error) {
        console.error(error);

        const reply = payload({
            description: "Не удалось выполнить команду.",
            color: 0xED4245,
            ephemeral: true
        });

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply).catch(() => {});
        } else {
            await interaction.reply(reply).catch(() => {});
        }
    }
}

function resolveCommand(client, name) {
    const normalized = String(name ?? "").toLowerCase();
    const key = client.commandAliases.get(normalized) ?? normalized;
    return client.commands.get(key) ?? null;
}

module.exports = {
    runCommand,
    resolveCommand
};
