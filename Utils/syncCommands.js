const economy = require("../Database/Economy");

function commandPayloads(commandMap) {
    return [...commandMap.values()].map(command => command.data.toJSON());
}

function customSlash(command) {
    return {
        name: command.name,
        description: (command.title || "Кастом").slice(0, 100) || "Кастом",
        type: 1
    };
}

async function syncGuildCustoms(guild, builtins) {
    const names = builtins instanceof Set ? builtins : new Set(builtins || []);
    const list = await economy.listCustomCommands(guild.id);
    const payload = list
        .filter(item => item.name && !names.has(item.name))
        .map(customSlash)
        .slice(0, 100);

    try {
        await guild.commands.set(payload);
        console.log(`Серверные команды ${guild.name}: ${payload.map(item => item.name).join(", ") || "нет"}`);
    } catch (error) {
        console.error(`Не удалось поставить команды ${guild.id}:`, error);
    }
}

async function syncCommands(client) {
    const payload = commandPayloads(client.commands);
    const builtins = new Set(payload.map(item => item.name));

    await client.application.commands.set(payload);
    console.log(`Глобальные команды: ${payload.map(command => command.name).join(", ")}`);

    for (const guild of client.guilds.cache.values()) {
        await syncGuildCustoms(guild, builtins);
    }
}

module.exports = {
    commandPayloads,
    syncGuildCustoms,
    syncCommands
};
