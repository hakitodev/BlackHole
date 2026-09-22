const { EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { getChannel } = require("../Utils/channel");

module.exports = {
    name: "guildMemberRemove",
    async execute(client, member) {
        const settings = await economy.getGuildSettings(member.guild.id);
        if (!settings.welcomeOn || !settings.welcomeChannel || !settings.leaveMessage) {
            return;
        }

        const channel = await getChannel(member.guild, settings.welcomeChannel);
        if (!channel) {
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription(
                settings.leaveMessage.replaceAll("{user}", `<@${member.id}>`)
            );

        await channel.send({ embeds: [embed] }).catch(error => {
            console.error(`leave ${member.guild.id}:`, error);
        });
    }
};
