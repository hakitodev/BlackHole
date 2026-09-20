const { ActivityType } = require("discord.js");

module.exports = {
    name: "ready",
    once: true,
    execute(client) {
        console.log(`Бот запущен как ${client.user.tag} | серверов: ${client.guilds.cache.size}`);
        client.user.setActivity("/daily", { type: ActivityType.Listening });
    }
};
