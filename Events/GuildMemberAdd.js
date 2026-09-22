const { EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { getChannel } = require("../Utils/channel");

module.exports = {
    name: "guildMemberAdd",
    async execute(client, member) {
        const settings = await economy.getGuildSettings(member.guild.id);
        if (!settings.welcomeOn || !settings.welcomeChannel || !settings.welcomeMessage) {
            return;
        }

        const channel = await getChannel(member.guild, settings.welcomeChannel);
        if (!channel) {
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setDescription(
                settings.welcomeMessage.replaceAll("{user}", `<@${member.id}>`)
            );

        await channel.send({ embeds: [embed] }).catch(error => {
            console.error(`welcome ${member.guild.id}:`, error);
        });
    }
};
