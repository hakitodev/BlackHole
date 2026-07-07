const { EmbedBuilder } = require('discord.js');
const { SERVERS } = require('../config');

module.exports = {
    name: 'guildMemberRemove',
    async execute(client, member) {
        const config = SERVERS[member.guild.id];
        if (!config) return;
        const channel = member.guild.channels.cache.get(config.channelId);
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setDescription(
                config.leaveMessage.replace('{user}', `<@${member.id}>`)
            );
        await channel.send({
            embeds: [embed]
        });
    }
};
