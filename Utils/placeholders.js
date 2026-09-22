const TAGS = [
    { tag: "{user}", hint: "упоминание" },
    { tag: "{user.name}", hint: "ник" },
    { tag: "{user.id}", hint: "id" },
    { tag: "{user.tag}", hint: "тег" },
    { tag: "{server}", hint: "сервер" },
    { tag: "{server.id}", hint: "id сервера" },
    { tag: "{count}", hint: "сколько людей" },
    { tag: "{level}", hint: "уровень" },
    { tag: "{xp}", hint: "опыт" },
    { tag: "{money}", hint: "награда за лвл" },
    { tag: "{channel}", hint: "канал" },
    { tag: "{reason}", hint: "причина" },
    { tag: "{text}", hint: "текст" },
    { tag: "{after}", hint: "новый текст" }
];

function userName(user) {
    return user?.globalName || user?.global_name || user?.displayName || user?.username || "";
}

function fill(template, vars = {}) {
    const user = vars.user;
    const guild = vars.guild;
    return String(template ?? "")
        .replaceAll("{user.name}", userName(user))
        .replaceAll("{user.tag}", user?.tag || user?.username || "")
        .replaceAll("{user.id}", user?.id ? String(user.id) : "")
        .replaceAll("{user}", user?.id ? `<@${user.id}>` : "")
        .replaceAll("{server.id}", guild?.id ? String(guild.id) : "")
        .replaceAll("{server}", guild?.name || "")
        .replaceAll("{count}", String(guild?.memberCount ?? vars.count ?? ""))
        .replaceAll("{level}", String(vars.level ?? ""))
        .replaceAll("{xp}", String(vars.xp ?? ""))
        .replaceAll("{money}", String(vars.money ?? ""))
        .replaceAll("{channel}", vars.channel || "")
        .replaceAll("{reason}", vars.reason || "")
        .replaceAll("{text}", vars.text || "")
        .replaceAll("{after}", vars.after || "");
}

module.exports = {
    TAGS,
    fill
};
