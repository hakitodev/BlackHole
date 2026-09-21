const { ActivityType } = require("discord.js");
const { syncCommands } = require("../Utils/syncCommands");
const { ownerIds } = require("../Utils/staff");

module.exports = {
    name: "ready",
    once: true,
    async execute(client) {
        console.log(`Бот запущен как ${client.user.tag} | серверов: ${client.guilds.cache.size}`);
        client.user.setActivity("/help", { type: ActivityType.Listening });

        try {
            await client.application.fetch();
            const owners = [...ownerIds(client)];
            console.log(owners.length
                ? `Владельцы бота: ${owners.join(", ")}`
                : "OWNER_ID не задан и владелец приложения не получен. Пропиши OWNER_ID в env.");
        } catch (error) {
            console.error("Не удалось получить владельца приложения:", error);
        }

        try {
            await syncCommands(client);
        } catch (error) {
            console.error("Не удалось синхронизировать команды:", error);
        }
    }
};
