const { EmbedBuilder } = require('discord.js');
const { SERVERS } = require('../Config');

module.exports = {
    name: 'guildMemberAdd',
    async execute(client, member) {
        const config = SERVERS[member.guild.id];
        if (!config) return;
        const channel = member.guild.channels.cache.get(config.channelId);
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setDescription(
                config.welcomeMessage.replace('{user}', `<@${member.id}>`)
            );
        await channel.send({
            embeds: [embed]
        });
    }
};
