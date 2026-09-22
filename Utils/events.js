const { EmbedBuilder } = require("discord.js");
const { getChannel } = require("./channel");
const { fill } = require("./placeholders");

const EVENT_TYPES = [
    { id: "join", title: "Вход", color: 0x57F287, hint: "{user} {server} {count}", fallback: "{user} зашёл на {server}. Сейчас {count}." },
    { id: "leave", title: "Выход", color: 0xED4245, hint: "{user} {server} {count}", fallback: "{user} вышел с {server}. Сейчас {count}." },
    { id: "ban", title: "Бан", color: 0xED4245, hint: "{user} {server} {reason}", fallback: "Бан: {user}\n{reason}" },
    { id: "unban", title: "Разбан", color: 0x57F287, hint: "{user} {server}", fallback: "Разбан: {user}" },
    { id: "kick", title: "Кик", color: 0xFEE75C, hint: "{user} {server} {reason}", fallback: "Кик: {user}\n{reason}" },
    { id: "timeout", title: "Таймаут", color: 0xFEE75C, hint: "{user} {reason}", fallback: "Таймаут: {user}\n{reason}" },
    { id: "timeoutEnd", title: "Снятие таймаута", color: 0x57F287, hint: "{user}", fallback: "Таймаут снят: {user}" },
    { id: "nick", title: "Ник", color: 0x5865F2, hint: "{user} {old} {text}", fallback: "{user}: {old} → {text}" },
    { id: "roleAdd", title: "Выдача роли", color: 0x57F287, hint: "{user} {role}", fallback: "{user} получил {role}" },
    { id: "roleRemove", title: "Снятие роли", color: 0xED4245, hint: "{user} {role}", fallback: "{user} потерял {role}" },
    { id: "roleCreate", title: "Создание роли", color: 0x57F287, hint: "{role} {server}", fallback: "Новая роль: {role}" },
    { id: "roleDelete", title: "Удаление роли", color: 0xED4245, hint: "{role} {server}", fallback: "Роль удалена: {role}" },
    { id: "channelCreate", title: "Создание канала", color: 0x57F287, hint: "{channel} {server}", fallback: "Канал создан: {channel}" },
    { id: "channelDelete", title: "Удаление канала", color: 0xED4245, hint: "{channel} {server}", fallback: "Канал удалён: {channel}" },
    { id: "threadCreate", title: "Создание треда", color: 0x57F287, hint: "{channel} {user}", fallback: "Тред: {channel}" },
    { id: "threadDelete", title: "Удаление треда", color: 0xED4245, hint: "{channel}", fallback: "Тред удалён: {channel}" },
    { id: "voiceJoin", title: "Вход в войса", color: 0x57F287, hint: "{user} {channel}", fallback: "{user} зашёл в {channel}" },
    { id: "voiceLeave", title: "Выход из войса", color: 0xED4245, hint: "{user} {channel}", fallback: "{user} вышел из {channel}" },
    { id: "voiceSwitch", title: "Смена войса", color: 0xFEE75C, hint: "{user} {old} {channel}", fallback: "{user}: {old} → {channel}" },
    { id: "inviteCreate", title: "Инвайт", color: 0x5865F2, hint: "{user} {invite} {channel}", fallback: "{user} создал инвайт {invite}" },
    { id: "messageDelete", title: "Удаление сообщения", color: 0xED4245, hint: "{user} {channel} {text}", fallback: "Удалено в {channel}\n{user}: {text}" },
    { id: "messageBulkDelete", title: "Массовое удаление", color: 0xED4245, hint: "{channel} {count}", fallback: "Удалено {count} сообщ. в {channel}" },
    { id: "messageUpdate", title: "Редактирование сообщения", color: 0xFEE75C, hint: "{user} {channel} {text} {after}", fallback: "Правка в {channel}\n{user}\nбыло: {text}\nстало: {after}" },
    { id: "emojiCreate", title: "Эмодзи", color: 0x57F287, hint: "{text} {server}", fallback: "Новый эмодзи: {text}" },
    { id: "guildUpdate", title: "Сервер", color: 0x5865F2, hint: "{old} {server}", fallback: "Сервер: {old} → {server}" },
    { id: "boost", title: "Буст", color: 0xEB459E, hint: "{user} {server} {count}", fallback: "{user} забустил {server}." },
    { id: "levelUp", title: "Уровень", color: 0xFEE75C, hint: "{user} {level} {server}", fallback: "{user} теперь {level} уровень!" },
    { id: "automodLog", title: "Автомод", color: 0xFEE75C, hint: "{user} {channel} {reason} {text}", fallback: "Автомод: {user} в {channel} — {reason}" }
];

const EVENT_MAP = new Map(EVENT_TYPES.map(item => [item.id, item]));

function eventType(name) {
    return EVENT_MAP.get(name) || null;
}

async function fireEvent(guild, name, vars = {}, fallbackChannel = null) {
    if (!guild) {
        return;
    }

    const economy = require("../Database/Economy");
    const type = eventType(name);
    const config = await economy.getGuildEvent(guild.id, name);
    const settings = await economy.getGuildSettings(guild.id);
    if (settings.paused || !type || !config?.enabled) {
        return;
    }

    const channel = (config.channel && await getChannel(guild, config.channel))
        || fallbackChannel;
    if (!channel) {
        return;
    }

    const text = fill(config.message || type.fallback, {
        ...vars,
        user: vars.user,
        guild,
        reason: vars.reason || "причина отсутствует",
        text: vars.text || "без текста",
        after: vars.after || "",
        role: vars.role || "",
        old: vars.old || "",
        invite: vars.invite || "",
        count: vars.count ?? guild.memberCount
    });

    await channel.send({
        embeds: [new EmbedBuilder().setColor(type.color).setDescription(text.slice(0, 4000))]
    }).catch(error => {
        console.error(`event ${name} ${guild.id}:`, error);
    });
}

module.exports = {
    EVENT_TYPES,
    eventType,
    fireEvent
};
