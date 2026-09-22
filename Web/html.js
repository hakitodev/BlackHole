const { escapeHtml } = require("./access");
const { inviteUrl } = require("./oauth");

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
            <p>Префикс, слэш-команды и приветствия — в одном месте, как у Juniper. Без возни в Discord.</p>
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
            ? `/servers/${guild.id}`
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

function settingsPage({ user, guild, settings, channels, saved }) {
    const options = [`<option value="">— не выбран —</option>`]
        .concat(channels.map(channel => {
            const selected = channel.id === settings.welcomeChannel ? " selected" : "";
            return `<option value="${escapeHtml(channel.id)}"${selected}>#${escapeHtml(channel.name)}</option>`;
        }))
        .join("");

    return layout({
        title: guild.name,
        user,
        body: `
          <p class="muted"><a href="/servers">← Серверы</a></p>
          <h1>${escapeHtml(guild.name)}</h1>
          ${saved ? `<div class="flash">Сохранено.</div>` : ""}
          <form class="stack card" method="post" action="/servers/${escapeHtml(guild.id)}">
            <div>
              <h2>Общие</h2>
              <label class="switch">
                <input type="checkbox" name="prefix" value="1" ${settings.prefix ? "checked" : ""}>
                Префикс-команды
              </label>
              <label><span>Префикс</span>
                <input type="text" name="prefixText" maxlength="8" value="${escapeHtml(settings.prefixText)}">
              </label>
            </div>
            <div class="section">
              <h2>Приветствия</h2>
              <label class="switch">
                <input type="checkbox" name="welcomeOn" value="1" ${settings.welcomeOn ? "checked" : ""}>
                Писать вход и выход
              </label>
              <label><span>Канал</span>
                <select name="welcomeChannel">${options}</select>
              </label>
              <label><span>Вход. <code>{user}</code> — упоминание</span>
                <textarea name="welcomeMessage">${escapeHtml(settings.welcomeMessage)}</textarea>
              </label>
              <label><span>Выход</span>
                <textarea name="leaveMessage">${escapeHtml(settings.leaveMessage)}</textarea>
              </label>
            </div>
            <button class="btn" type="submit">Сохранить</button>
          </form>
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
    layout,
    homePage,
    serversPage,
    settingsPage,
    errorPage
};
