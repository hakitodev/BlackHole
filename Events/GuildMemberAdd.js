const { EmbedBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { getChannel } = require("../Utils/channel");
const { fill } = require("../Utils/placeholders");
const { guildLog } = require("../Utils/log");
const { roleError } = require("../Utils/roles");

async function applyAutoroles(member, settings) {
    if (!settings.autoroles.length) {
        return;
    }

    const me = member.guild.members.me;
    for (const roleId of settings.autoroles) {
        const role = member.guild.roles.cache.get(roleId);
        if (roleError(role, member, me)) {
            continue;
        }
        await member.roles.add(role).catch(error => {
            console.error(`autorole ${member.guild.id} ${roleId}:`, error);
        });
    }
}

module.exports = {
    name: "guildMemberAdd",
    async execute(client, member) {
        const settings = await economy.getGuildSettings(member.guild.id);
        await applyAutoroles(member, settings);

        await guildLog(member.guild, settings, "joins", {
            embeds: [
                new EmbedBuilder()
                    .setColor(0x57F287)
                    .setDescription(`${member} зашёл. Сейчас **${member.guild.memberCount}** человек.`)
            ]
        });

        if (!settings.welcomeOn || !settings.welcomeChannel || !settings.welcomeMessage) {
            return;
        }

        const channel = await getChannel(member.guild, settings.welcomeChannel);
        if (!channel) {
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setDescription(fill(settings.welcomeMessage, {
                user: member.user,
                guild: member.guild
            }));

        await channel.send({ embeds: [embed] }).catch(error => {
            console.error(`welcome ${member.guild.id}:`, error);
        });
    }
};
