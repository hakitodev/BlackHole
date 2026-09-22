const { syncGuildCustoms } = require("../Utils/syncCommands");

module.exports = {
    name: "guildCreate",
    async execute(client, guild) {
        await syncGuildCustoms(guild, new Set(client.commands.keys())).catch(error => {
            console.error(`guildCreate sync ${guild.id}:`, error);
        });
    }
};
