const { EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { getChannel } = require("../Utils/channel");
const { fill } = require("../Utils/placeholders");
const { guildLog } = require("../Utils/log");

module.exports = {
    name: "guildMemberRemove",
    async execute(client, member) {
        const settings = await economy.getGuildSettings(member.guild.id);

        await guildLog(member.guild, settings, "joins", {
            embeds: [
                new EmbedBuilder()
                    .setColor(0xED4245)
                    .setDescription(`${member.user?.tag || member.id} вышел. Сейчас **${member.guild.memberCount}** человек.`)
            ]
        });

        if (!settings.welcomeOn || !settings.welcomeChannel || !settings.leaveMessage) {
            return;
        }

        const channel = await getChannel(member.guild, settings.welcomeChannel);
        if (!channel) {
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription(fill(settings.leaveMessage, {
                user: member.user,
                guild: member.guild
            }));

        await channel.send({ embeds: [embed] }).catch(error => {
            console.error(`leave ${member.guild.id}:`, error);
        });
    }
};
