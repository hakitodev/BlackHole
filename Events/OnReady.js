const { ActivityType } = require("discord.js");
const { syncCommands } = require("../Utils/syncCommands");

module.exports = {
    name: "ready",
    once: true,
    async execute(client) {
        console.log(`Бот запущен как ${client.user.tag} | серверов: ${client.guilds.cache.size}`);
        client.user.setActivity("/bal", { type: ActivityType.Listening });

        try {
            await syncCommands(client);
        } catch (error) {
            console.error("Не удалось синхронизировать команды:", error);
        }
    }
};
