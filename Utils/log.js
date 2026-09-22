const { getChannel } = require("./channel");

async function guildLog(guild, settings, kind, payload) {
    const enabled = {
        joins: settings.logJoins,
        messages: settings.logMessages,
        mod: settings.logMod
    }[kind];

    if (!enabled || !settings.logChannel || !guild) {
        return;
    }

    const channel = await getChannel(guild, settings.logChannel);
    if (!channel) {
        return;
    }

    await channel.send(payload).catch(error => {
        console.error(`log ${kind} ${guild.id}:`, error);
    });
}

module.exports = {
    guildLog
};
