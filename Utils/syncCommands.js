function commandPayloads(commandMap) {
    return [...commandMap.values()].map(command => command.data.toJSON());
}

async function clearGuildCommands(client) {
    const guilds = [...client.guilds.cache.values()];

    for (const guild of guilds) {
        try {
            await guild.commands.set([]);
            console.log(`Серверные команды очищены: ${guild.name}`);
        } catch (error) {
            console.error(`Не удалось очистить команды ${guild.id}:`, error);
        }
    }
}

async function syncCommands(client) {
    const payload = commandPayloads(client.commands);

    await client.application.commands.set(payload);
    console.log(`Глобальные команды: ${payload.map(command => command.name).join(", ")}`);

    await clearGuildCommands(client);
}

module.exports = {
    commandPayloads,
    clearGuildCommands,
    syncCommands
};
