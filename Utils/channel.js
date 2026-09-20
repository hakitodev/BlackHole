async function getChannel(guild, channelId) {
    return guild.channels.cache.get(channelId)
        ?? await guild.channels.fetch(channelId).catch(() => null);
}

module.exports = {
    getChannel
};
