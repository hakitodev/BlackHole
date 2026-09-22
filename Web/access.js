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
    escapeHtml,
    parseForm
};
