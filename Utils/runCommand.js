async function runCommand(command, interaction) {
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);

        const reply = {
            content: "Произошла ошибка при выполнении команды.",
            ephemeral: true
        };

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
