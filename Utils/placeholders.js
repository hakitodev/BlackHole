function fill(template, { user, guild, level } = {}) {
    return String(template ?? "")
        .replaceAll("{user}", user?.id ? `<@${user.id}>` : "")
        .replaceAll("{server}", guild?.name || "")
        .replaceAll("{count}", String(guild?.memberCount ?? ""))
        .replaceAll("{level}", String(level ?? ""));
}

module.exports = {
    fill
};
