const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "guildMemberUpdate",
    async execute(client, oldMember, newMember) {
        if (!oldMember.premiumSince && newMember.premiumSince) {
            await fireEvent(newMember.guild, "boost", { user: newMember.user });
        }

        const oldNick = oldMember.nickname || oldMember.user?.username || "";
        const newNick = newMember.nickname || newMember.user?.username || "";
        if (oldMember.nickname !== newMember.nickname) {
            await fireEvent(newMember.guild, "nick", {
                user: newMember.user,
                old: oldNick || "без ника",
                text: newNick || "без ника"
            });
        }

        const oldT = oldMember.communicationDisabledUntilTimestamp;
        const newT = newMember.communicationDisabledUntilTimestamp;
        if (!oldT && newT) {
            await fireEvent(newMember.guild, "timeout", { user: newMember.user });
        } else if (oldT && !newT) {
            await fireEvent(newMember.guild, "timeoutEnd", { user: newMember.user });
        }

        const oldRoles = oldMember.roles?.cache;
        const newRoles = newMember.roles?.cache;
        if (oldRoles && newRoles) {
            for (const role of newRoles.values()) {
                if (role.id === newMember.guild.id || oldRoles.has(role.id)) {
                    continue;
                }
                await fireEvent(newMember.guild, "roleAdd", {
                    user: newMember.user,
                    role: role.name
                });
            }
            for (const role of oldRoles.values()) {
                if (role.id === newMember.guild.id || newRoles.has(role.id)) {
                    continue;
                }
                await fireEvent(newMember.guild, "roleRemove", {
                    user: newMember.user,
                    role: role.name
                });
            }
        }
    }
};
