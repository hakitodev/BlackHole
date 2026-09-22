const { EmbedBuilder } = require("discord.js");
const { getChannel } = require("./channel");
const { fill } = require("./placeholders");

const EVENT_TYPES = [
    {
        id: "join",
        title: "Вход",
        color: 0x57F287,
        hint: "{user} {server} {count}",
        fallback: "{user} зашёл на {server}. Сейчас {count}."
    },
    {
        id: "leave",
        title: "Выход",
        color: 0xED4245,
        hint: "{user} {server} {count}",
        fallback: "{user} вышел с {server}. Сейчас {count}."
    },
    {
        id: "ban",
        title: "Бан",
        color: 0xED4245,
        hint: "{user} {server} {reason}",
        fallback: "Бан: {user}\n{reason}"
    },
    {
        id: "unban",
        title: "Разбан",
        color: 0x57F287,
        hint: "{user} {server}",
        fallback: "Разбан: {user}"
    },
    {
        id: "kick",
        title: "Кик",
        color: 0xFEE75C,
        hint: "{user} {server} {reason}",
        fallback: "Кик: {user}\n{reason}"
    },
    {
        id: "messageDelete",
        title: "Удаление сообщения",
        color: 0xED4245,
        hint: "{user} {channel} {text}",
        fallback: "Удалено в {channel}\n{user}: {text}"
    },
    {
        id: "messageUpdate",
        title: "Редактирование сообщения",
        color: 0xFEE75C,
        hint: "{user} {channel} {text} {after}",
        fallback: "Правка в {channel}\n{user}\nбыло: {text}\nстало: {after}"
    },
    {
        id: "boost",
        title: "Буст",
        color: 0xEB459E,
        hint: "{user} {server} {count}",
        fallback: "{user} забустил {server}."
    },
    {
        id: "levelUp",
        title: "Уровень",
        color: 0xFEE75C,
        hint: "{user} {level} {server}",
        fallback: "{user} теперь {level} уровень!"
    },
    {
        id: "automodLog",
        title: "Срабатывание автомода",
        color: 0xFEE75C,
        hint: "{user} {channel} {reason} {text}",
        fallback: "Автомод: {user} в {channel} — {reason}"
    }
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
    if (!type || !config?.enabled) {
        return;
    }

    const channel = (config.channel && await getChannel(guild, config.channel))
        || fallbackChannel;
    if (!channel) {
        return;
    }

    const text = fill(config.message || type.fallback, {
        user: vars.user,
        guild,
        level: vars.level,
        ...vars
    }).replaceAll("{channel}", vars.channel || "")
        .replaceAll("{reason}", vars.reason || "причина отсутствует")
        .replaceAll("{text}", vars.text || "без текста")
        .replaceAll("{after}", vars.after || "");

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
