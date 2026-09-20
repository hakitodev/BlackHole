const { EmbedBuilder } = require("discord.js");
const { SERVERS } = require("../Config");
const { getChannel } = require("../Utils/channel");

module.exports = {
    name: "guildMemberRemove",
    async execute(client, member) {
        const config = SERVERS[member.guild.id];
        if (!config) return;

        const channel = await getChannel(member.guild, config.channelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription(
                config.leaveMessage.replace("{user}", `<@${member.id}>`)
            );

        await channel.send({ embeds: [embed] }).catch(error => {
            console.error(`leave ${member.guild.id}:`, error);
        });
    }
};
