const { AuditLogEvent } = require("discord.js");
const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "guildMemberRemove",
    async execute(client, member) {
        const user = member.user;
        let kicked = false;

        try {
            const logs = await member.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberKick,
                limit: 5
            });
            const entry = logs.entries.find(item =>
                item.target?.id === member.id &&
                Date.now() - item.createdTimestamp < 8000
            );
            if (entry) {
                kicked = true;
                await fireEvent(member.guild, "kick", {
                    user,
                    reason: entry.reason || "причина отсутствует"
                });
            }
        } catch {
            kicked = false;
        }

        if (!kicked) {
            await fireEvent(member.guild, "leave", { user });
        }
    }
};
