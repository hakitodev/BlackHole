const { escapeHtml } = require("./access");
const { inviteUrl } = require("./oauth");

const MODULES = [
    { id: "general", title: "Общие" },
    { id: "welcome", title: "Приветствия" },
    { id: "autorole", title: "Автороль" },
    { id: "logs", title: "Логи" },
    { id: "levels", title: "Уровни" },
    { id: "automod", title: "Автомод" },
    { id: "commands", title: "Команды" }
];

function layout({ title, user, body }) {
    const avatar = user
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
        : "";

    return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · BlackHole</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header class="top">
    <a class="brand" href="${user ? "/servers" : "/"}">
      <svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="#161622" stroke="#6d5cff" stroke-width="2"/>
        <circle cx="16" cy="16" r="6" fill="#e8c547"/>
        <circle cx="16" cy="16" r="2.5" fill="#0b0b10"/>
      </svg>
      BlackHole
    </a>
    <nav class="nav">
      ${user ? `
        <span class="user">
          ${user.avatar ? `<img src="${escapeHtml(avatar)}" alt="">` : ""}
          ${escapeHtml(user.global_name || user.username)}
        </span>
        <a class="btn ghost" href="/logout">Выйти</a>
      ` : `<a class="btn discord" href="/login">Войти через Discord</a>`}
    </nav>
  </header>
  <main class="wrap">
    ${body}
  </main>
</body>
</html>`;
}

function homePage({ user, configured }) {
    return layout({
        title: "Панель",
        user,
        body: `
          <section class="hero">
            <h1>Настрой бота с сайта</h1>
            <p>Приветствия, автороль, логи, уровни, автомод и свои команды — как у Juniper, без возни в чате.</p>
            <div class="row">
              ${configured
                ? (user
                    ? `<a class="btn" href="/servers">Мои серверы</a>`
                    : `<a class="btn discord" href="/login">Войти через Discord</a>`)
                : `<div class="warn">Панель почти готова. В env нужны <code>CLIENT_SECRET</code> и <code>PUBLIC_URL</code>.</div>`}
              <a class="btn ghost" href="${escapeHtml(inviteUrl())}">Добавить на сервер</a>
            </div>
          </section>
        `
    });
}

function serversPage({ user, guilds }) {
    const cards = guilds.map(guild => {
        const icon = guild.icon
            ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`
            : "";
        const href = guild.bot
            ? `/servers/${guild.id}/general`
            : inviteUrl(guild.id);
        return `
          <a class="card server" href="${escapeHtml(href)}">
            <div class="server-head">
              ${icon
                ? `<img class="icon" src="${escapeHtml(icon)}" alt="">`
                : `<div class="icon-fallback">${escapeHtml((guild.name || "?")[0])}</div>`}
              <div>
                <div>${escapeHtml(guild.name)}</div>
                <div class="tag">${guild.bot ? "Открыть настройки" : "Бот ещё не на сервере"}</div>
              </div>
            </div>
          </a>
        `;
    }).join("");

    return layout({
        title: "Серверы",
        user,
        body: `
          <h1>Мои серверы</h1>
          <p class="muted">Нужны права администратора или «Управление сервером».</p>
          <div class="grid" style="margin-top:20px">
            ${cards || `<div class="card">Нет серверов, которыми ты можешь управлять.</div>`}
          </div>
        `
    });
}

function channelOptions(channels, selected) {
    return [`<option value="">— не выбран —</option>`]
        .concat(channels.map(channel => {
            const isSelected = channel.id === selected ? " selected" : "";
            return `<option value="${escapeHtml(channel.id)}"${isSelected}>#${escapeHtml(channel.name)}</option>`;
        }))
        .join("");
}

function moduleForm(module, guild, settings, { channels, roles, commands }) {
    const action = `/servers/${escapeHtml(guild.id)}/${module}`;

    if (module === "welcome") {
        return `
          <form class="stack card" method="post" action="${action}">
            <h2>Приветствия</h2>
            <input type="hidden" name="welcomeOn" value="0">
            <label class="switch">
              <input type="checkbox" name="welcomeOn" value="1" ${settings.welcomeOn ? "checked" : ""}>
              Писать вход и выход
            </label>
            <label><span>Канал</span>
              <select name="welcomeChannel">${channelOptions(channels, settings.welcomeChannel)}</select>
            </label>
            <label><span>Вход. <code>{user}</code> <code>{server}</code> <code>{count}</code></span>
              <textarea name="welcomeMessage">${escapeHtml(settings.welcomeMessage)}</textarea>
            </label>
            <label><span>Выход</span>
              <textarea name="leaveMessage">${escapeHtml(settings.leaveMessage)}</textarea>
            </label>
            <button class="btn" type="submit">Сохранить</button>
          </form>`;
    }

    if (module === "autorole") {
        const boxes = roles.length
            ? roles.map(role => `
                <label class="switch">
                  <input type="checkbox" name="autorole" value="${escapeHtml(role.id)}" ${
                      settings.autoroles.includes(role.id) ? "checked" : ""
                  }>
                  ${escapeHtml(role.name)}
                </label>`).join("")
            : `<p class="muted">Нет ролей, которые бот может выдать. Поставь роль бота выше нужных.</p>`;
        return `
          <form class="stack card" method="post" action="${action}">
            <h2>Автороль</h2>
            <p class="muted">Выдаётся при входе. Не больше 8, без админских прав.</p>
            ${boxes}
            <button class="btn" type="submit">Сохранить</button>
          </form>`;
    }

    if (module === "logs") {
        return `
          <form class="stack card" method="post" action="${action}">
            <h2>Логи</h2>
            <label><span>Канал</span>
              <select name="logChannel">${channelOptions(channels, settings.logChannel)}</select>
            </label>
            <input type="hidden" name="logJoins" value="0">
            <label class="switch">
              <input type="checkbox" name="logJoins" value="1" ${settings.logJoins ? "checked" : ""}>
              Входы и выходы
            </label>
            <input type="hidden" name="logMessages" value="0">
            <label class="switch">
              <input type="checkbox" name="logMessages" value="1" ${settings.logMessages ? "checked" : ""}>
              Удалённые сообщения
            </label>
            <input type="hidden" name="logMod" value="0">
            <label class="switch">
              <input type="checkbox" name="logMod" value="1" ${settings.logMod ? "checked" : ""}>
              Баны и автомод
            </label>
            <button class="btn" type="submit">Сохранить</button>
          </form>`;
    }

    if (module === "levels") {
        return `
          <form class="stack card" method="post" action="${action}">
            <h2>Уровни</h2>
            <p class="muted">XP за сообщения раз в минуту. <code>/profile</code> и <code>/rank</code>.</p>
            <input type="hidden" name="levelsOn" value="0">
            <label class="switch">
              <input type="checkbox" name="levelsOn" value="1" ${settings.levelsOn ? "checked" : ""}>
              Писать повышение уровня
            </label>
            <label><span>Канал. Пусто — туда же, где написали</span>
              <select name="levelsChannel">${channelOptions(channels, settings.levelsChannel)}</select>
            </label>
            <label><span>Текст. <code>{user}</code> <code>{level}</code></span>
              <textarea name="levelsMessage">${escapeHtml(settings.levelsMessage)}</textarea>
            </label>
            <button class="btn" type="submit">Сохранить</button>
          </form>`;
    }

    if (module === "automod") {
        return `
          <form class="stack card" method="post" action="${action}">
            <h2>Автомод</h2>
            <p class="muted">Админов не трогает. Слова — с новой строки или через запятую.</p>
            <input type="hidden" name="automodInvites" value="0">
            <label class="switch">
              <input type="checkbox" name="automodInvites" value="1" ${settings.automodInvites ? "checked" : ""}>
              Удалять инвайты Discord
            </label>
            <label><span>Запрещённые слова</span>
              <textarea name="automodWords">${escapeHtml(settings.automodWords)}</textarea>
            </label>
            <button class="btn" type="submit">Сохранить</button>
          </form>`;
    }

    if (module === "commands") {
        const rows = (commands || []).map(item => `
          <tr>
            <td><code>${escapeHtml(item.name)}</code></td>
            <td>${escapeHtml(item.response)}</td>
            <td>
              <form method="post" action="${action}">
                <input type="hidden" name="op" value="delete">
                <input type="hidden" name="name" value="${escapeHtml(item.name)}">
                <button class="btn ghost" type="submit">Удалить</button>
              </form>
            </td>
          </tr>`).join("");
        return `
          <div class="stack card">
            <h2>Свои команды</h2>
            <p class="muted">Пишутся с префиксом сервера, даже если слэш-команды выключены. До 25 штук. <code>{user}</code> <code>{server}</code></p>
            <table class="table">
              <thead><tr><th>Имя</th><th>Ответ</th><th></th></tr></thead>
              <tbody>${rows || `<tr><td colspan="3" class="muted">Пока пусто.</td></tr>`}</tbody>
            </table>
            <form class="stack" method="post" action="${action}">
              <input type="hidden" name="op" value="add">
              <label><span>Имя</span>
                <input type="text" name="name" maxlength="32" placeholder="hi">
              </label>
              <label><span>Ответ</span>
                <textarea name="response" placeholder="Привет, {user}"></textarea>
              </label>
              <button class="btn" type="submit">Добавить</button>
            </form>
          </div>`;
    }

    return `
      <form class="stack card" method="post" action="${action}">
        <h2>Общие</h2>
        <input type="hidden" name="prefix" value="0">
        <label class="switch">
          <input type="checkbox" name="prefix" value="1" ${settings.prefix ? "checked" : ""}>
          Префикс-команды
        </label>
        <label><span>Префикс</span>
          <input type="text" name="prefixText" maxlength="8" value="${escapeHtml(settings.prefixText)}">
        </label>
        <button class="btn" type="submit">Сохранить</button>
      </form>`;
}

function settingsPage({
    user,
    guild,
    settings,
    channels = [],
    roles = [],
    commands = [],
    module = "general",
    saved
}) {
    const current = MODULES.some(item => item.id === module) ? module : "general";
    const data = {
        prefix: true,
        prefixText: "!",
        welcomeOn: false,
        welcomeChannel: "",
        welcomeMessage: "",
        leaveMessage: "",
        autoroles: [],
        logChannel: "",
        logJoins: false,
        logMessages: false,
        logMod: false,
        levelsOn: false,
        levelsChannel: "",
        levelsMessage: "",
        automodInvites: false,
        automodWords: "",
        ...settings
    };
    const links = MODULES.map(item => `
      <a class="${item.id === current ? "active" : ""}" href="/servers/${escapeHtml(guild.id)}/${item.id}">
        ${escapeHtml(item.title)}
      </a>`).join("");

    return layout({
        title: guild.name,
        user,
        body: `
          <p class="muted"><a href="/servers">← Серверы</a></p>
          <h1>${escapeHtml(guild.name)}</h1>
          ${saved ? `<div class="flash">Сохранено.</div>` : ""}
          <div class="dash">
            <nav class="side">${links}</nav>
            <div>${moduleForm(current, guild, data, { channels, roles, commands })}</div>
          </div>
        `
    });
}

function errorPage({ user, message, action }) {
    return layout({
        title: "Ошибка",
        user,
        body: `<div class="warn">${escapeHtml(message)}</div>${action || `<p><a href="/">На главную</a></p>`}`
    });
}

module.exports = {
    MODULES,
    layout,
    homePage,
    serversPage,
    settingsPage,
    errorPage
};
