const { roleError } = require("./roles");

async function applyAutoroles(member, settings) {
    if (!settings?.autoroles?.length) {
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
    applyAutoroles
};
