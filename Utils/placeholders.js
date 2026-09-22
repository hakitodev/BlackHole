const TAGS = [
    { tag: "{user}", hint: "Пинг человека, с которым случилось событие. В кастом-команде — кто её вызвал." },
    { tag: "{user.name}", hint: "Имя без пинга. Удобно в заголовке эмбеда." },
    { tag: "{user.id}", hint: "Discord ID цифрами." },
    { tag: "{user.tag}", hint: "Ник#тег или просто ник, если тега нет." },
    { tag: "{server}", hint: "Название этого сервера." },
    { tag: "{server.id}", hint: "ID сервера." },
    { tag: "{count}", hint: "Сколько людей на сервере. Для массового удаления — сколько сообщений." },
    { tag: "{level}", hint: "Новый уровень. Только ивент уровня." },
    { tag: "{xp}", hint: "Опыт после апа. Только ивент уровня." },
    { tag: "{money}", hint: "Сколько монет упало за уровень." },
    { tag: "{channel}", hint: "Канал: #чат или войса." },
    { tag: "{role}", hint: "Название роли: выдача, снятие, создание, удаление." },
    { tag: "{old}", hint: "Старое значение: ник, канал, имя сервера." },
    { tag: "{invite}", hint: "Код инвайта." },
    { tag: "{reason}", hint: "Причина бана, кика, таймаута, автомода." },
    { tag: "{text}", hint: "Текст сообщения, новый ник, эмодзи." },
    { tag: "{after}", hint: "Новый текст после правки сообщения." }
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
        .replaceAll("{count}", String(vars.count ?? guild?.memberCount ?? ""))
        .replaceAll("{level}", String(vars.level ?? ""))
        .replaceAll("{xp}", String(vars.xp ?? ""))
        .replaceAll("{money}", String(vars.money ?? ""))
        .replaceAll("{channel}", vars.channel || "")
        .replaceAll("{role}", vars.role || "")
        .replaceAll("{old}", vars.old || "")
        .replaceAll("{invite}", vars.invite || "")
        .replaceAll("{reason}", vars.reason || "")
        .replaceAll("{text}", vars.text || "")
        .replaceAll("{after}", vars.after || "");
}

module.exports = {
    TAGS,
    fill
};
