const ADMIN = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

function canManageGuild(permissions, owner = false) {
    if (owner) {
        return true;
    }

    try {
        const bits = BigInt(permissions ?? 0);
        return (bits & ADMIN) === ADMIN || (bits & MANAGE_GUILD) === MANAGE_GUILD;
    } catch {
        return false;
    }
}

function flagsHas(perms, flag) {
    try {
        return Boolean(perms.has(flag));
    } catch {
        return false;
    }
}

function memberCanManage(guild, userId) {
    if (!guild || !userId) {
        return false;
    }

    if (guild.ownerId && String(guild.ownerId) === String(userId)) {
        return true;
    }

    const member = guild.members?.cache?.get(String(userId));
    if (!member) {
        return false;
    }

    const perms = member.permissions;
    if (perms && typeof perms.has === "function") {
        return flagsHas(perms, "Administrator")
            || flagsHas(perms, "ManageGuild")
            || flagsHas(perms, 8n)
            || flagsHas(perms, 32n);
    }

    return canManageGuild(perms?.bitfield ?? perms ?? 0, false);
}

async function assertGuildManage(guild, userId) {
    if (memberCanManage(guild, userId)) {
        return true;
    }

    if (guild?.members?.fetch) {
        const member = await guild.members.fetch(String(userId)).catch(() => null);
        if (member && memberCanManage({ ...guild, members: { cache: new Map([[String(userId), member]]) }, ownerId: guild.ownerId }, userId)) {
            return true;
        }
        if (member) {
            const perms = member.permissions;
            if (perms && typeof perms.has === "function") {
                return flagsHas(perms, "Administrator")
                    || flagsHas(perms, "ManageGuild")
                    || flagsHas(perms, 8n)
                    || flagsHas(perms, 32n);
            }
            return canManageGuild(perms?.bitfield ?? perms ?? 0, false);
        }
    }

    return false;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[char]));
}

function parseForm(body) {
    const params = new URLSearchParams(body);
    const data = {};
    for (const [key, value] of params.entries()) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            data[key] = [].concat(data[key], value);
        } else {
            data[key] = value;
        }
    }
    return data;
}

module.exports = {
    ADMIN,
    MANAGE_GUILD,
    canManageGuild,
    memberCanManage,
    assertGuildManage,
    escapeHtml,
    parseForm
};
