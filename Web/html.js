const { escapeHtml } = require("./access");
const { inviteUrl } = require("./oauth");
const { EVENT_TYPES } = require("../Utils/events");
const { RESTRICTABLE } = require("../Utils/commands");
const { toHex } = require("../Utils/color");

const MODULES = [
    { id: "general", title: "Общие" },
    { id: "autorole", title: "Автороль" },
    { id: "automod", title: "Автомод" },
    { id: "limits", title: "Ограничения" },
    { id: "shop", title: "Магазин" },
    { id: "commands", title: "Команды" },
    { heading: "Ивенты" },
    ...EVENT_TYPES.map(item => ({
        id: item.id,
        title: item.title,
        event: true,
        hint: item.hint,
        fallback: item.fallback
    }))
];

function layout({ title, user, admin, body }) {
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
        ${admin ? `<a class="btn ghost" href="/admin/economy">Экономика</a>
        <a class="btn ghost" href="/admin/shop">Глобальный шоп</a>` : ""}
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

function homePage({ user, configured, admin }) {
    return layout({
        title: "Панель",
        user,
        admin,
        body: `
          <section class="hero">
            <h1>Настрой бота с сайта</h1>
            <p>Ивенты по отдельности, эмбед-редактор команд, магазин сервера и ограничения — без возни в чате.</p>
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

function serversPage({ user, guilds, admin }) {
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
        admin,
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

function eventModule(id) {
    return MODULES.find(item => item.event && item.id === id) || null;
}

function eventForm(type, guild, event, channels) {
    const action = `/servers/${escapeHtml(guild.id)}/${escapeHtml(type.id)}`;
    return `
      <form class="stack card" method="post" action="${action}">
        <h2>${escapeHtml(type.title)}</h2>
        <p class="muted">Свой канал и текст. Плейсхолдеры: <code>${escapeHtml(type.hint)}</code></p>
        <input type="hidden" name="enabled" value="0">
        <label class="switch">
          <input type="checkbox" name="enabled" value="1" ${event.enabled ? "checked" : ""}>
          Включить
        </label>
        <label><span>Канал</span>
          <select name="channel">${channelOptions(channels, event.channel)}</select>
        </label>
        <label><span>Сообщение. Пусто — дефолт: ${escapeHtml(type.fallback)}</span>
          <textarea name="message">${escapeHtml(event.message || "")}</textarea>
        </label>
        <button class="btn" type="submit">Сохранить</button>
      </form>`;
}

function shopTable(items, action, empty) {
    const rows = (items || []).map(item => `
      <tr>
        <td>${escapeHtml(item.emoji)} <code>${escapeHtml(item.id)}</code></td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(String(item.price))}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>
          <form method="post" action="${action}">
            <input type="hidden" name="op" value="delete">
            <input type="hidden" name="id" value="${escapeHtml(item.id)}">
            <button class="btn ghost" type="submit">Удалить</button>
          </form>
        </td>
      </tr>`).join("");

    return `
      <table class="table">
        <thead><tr><th>ID</th><th>Название</th><th>Цена</th><th>Текст</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5" class="muted">${escapeHtml(empty)}</td></tr>`}</tbody>
      </table>`;
}

function shopEditor(action, extra = "") {
    return `
      <form class="stack" method="post" action="${action}">
        <input type="hidden" name="op" value="save">
        ${extra}
        <div class="split">
          <label><span>ID латиницей</span>
            <input type="text" name="id" maxlength="32" placeholder="coffee">
          </label>
          <label><span>Эмодзи</span>
            <input type="text" name="emoji" maxlength="16" placeholder="☕">
          </label>
        </div>
        <label><span>Название</span>
          <input type="text" name="name" maxlength="64" placeholder="Кофе">
        </label>
        <label><span>Цена</span>
          <input type="number" name="price" min="0" max="100000000" value="100">
        </label>
        <label><span>Описание</span>
          <textarea name="description" placeholder="Зачем это нужно"></textarea>
        </label>
        <button class="btn" type="submit">Сохранить предмет</button>
      </form>`;
}

function commandEditor(guild, command = {}) {
    const action = `/servers/${escapeHtml(guild.id)}/commands`;
    const color = toHex(command.color);
    return `
      <form class="stack card embed-editor" method="post" action="${action}">
        <h2>${command.name ? `Редактор · ${escapeHtml(command.name)}` : "Новая команда"}</h2>
        <p class="muted">Как эмбед в Discord: заголовок, текст, цвет, картинка, футер. Пишется с префикса сервера. <code>{user}</code> <code>{server}</code> <code>{count}</code></p>
        <input type="hidden" name="op" value="save">
        <label><span>Имя команды</span>
          <input type="text" name="name" maxlength="32" value="${escapeHtml(command.name || "")}" ${command.name ? "readonly" : ""} placeholder="hi" required>
        </label>
        <label><span>Заголовок</span>
          <input type="text" name="title" maxlength="256" value="${escapeHtml(command.title || "")}" placeholder="Привет">
        </label>
        <label><span>Текст эмбеда</span>
          <textarea name="response" placeholder="Привет, {user}">${escapeHtml(command.response || "")}</textarea>
        </label>
        <div class="split">
          <label><span>Цвет</span>
            <input type="color" name="color" value="${escapeHtml(color)}">
          </label>
          <label><span>HEX</span>
            <input type="text" name="colorHex" value="${escapeHtml(color)}" maxlength="7">
          </label>
        </div>
        <label><span>Картинка URL</span>
          <input type="text" name="image" maxlength="500" value="${escapeHtml(command.image || "")}" placeholder="https://">
        </label>
        <label><span>Превью слева URL</span>
          <input type="text" name="thumbnail" maxlength="500" value="${escapeHtml(command.thumbnail || "")}" placeholder="https://">
        </label>
        <label><span>Футер</span>
          <input type="text" name="footer" maxlength="200" value="${escapeHtml(command.footer || "")}">
        </label>
        <div class="embed-preview" style="border-left-color:${escapeHtml(color)}">
          <div class="muted">Так примерно выглядит эмбед</div>
          <strong>${escapeHtml(command.title || "Заголовок")}</strong>
          <p>${escapeHtml(command.response || "Текст")}</p>
        </div>
        <button class="btn" type="submit">${command.name ? "Сохранить" : "Создать"}</button>
      </form>`;
}

function moduleForm(module, guild, settings, extras) {
    const action = `/servers/${escapeHtml(guild.id)}/${module}`;
    const {
        channels = [],
        roles = [],
        commands = [],
        event = { enabled: false, channel: "", message: "" },
        shop = [],
        editCommand = null
    } = extras;

    const eventType = eventModule(module);
    if (eventType) {
        return eventForm(eventType, guild, event, channels);
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

    if (module === "automod") {
        return `
          <form class="stack card" method="post" action="${action}">
            <h2>Автомод</h2>
            <p class="muted">Админов не трогает. Слова — с новой строки или через запятую. Куда писать о срабатывании — отдельный ивент слева.</p>
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

    if (module === "limits") {
        const boxes = RESTRICTABLE.map(item => `
          <label class="switch">
            <input type="checkbox" name="disabled" value="${escapeHtml(item.id)}" ${
                settings.disabledCommands.includes(item.id) ? "checked" : ""
            }>
            Выключить ${escapeHtml(item.title)}
          </label>`).join("");
        return `
          <form class="stack card" method="post" action="${action}">
            <h2>Ограничения команд</h2>
            <p class="muted">Выключенные команды не работают ни слэшем, ни префиксом. help / settings / мод-команды не трогаем.</p>
            <div class="checks">${boxes}</div>
            <div class="split">
              <label><span>Flip минимум</span>
                <input type="number" name="flipMin" min="1" max="10000" value="${escapeHtml(String(settings.flipMin))}">
              </label>
              <label><span>Flip максимум</span>
                <input type="number" name="flipMax" min="10" max="1000000" value="${escapeHtml(String(settings.flipMax))}">
              </label>
            </div>
            <div class="split">
              <label><span>Pay минимум</span>
                <input type="number" name="payMin" min="1" max="1000000" value="${escapeHtml(String(settings.payMin))}">
              </label>
              <label><span>Pay максимум, 0 — без потолка</span>
                <input type="number" name="payMax" min="0" max="100000000" value="${escapeHtml(String(settings.payMax))}">
              </label>
            </div>
            <div class="split">
              <label><span>Rob: минимум наличных у цели</span>
                <input type="number" name="robMin" min="1" max="100000" value="${escapeHtml(String(settings.robMin))}">
              </label>
              <label><span>Buy: максимум штук за раз</span>
                <input type="number" name="buyMax" min="1" max="50" value="${escapeHtml(String(settings.buyMax))}">
              </label>
            </div>
            <button class="btn" type="submit">Сохранить</button>
          </form>`;
    }

    if (module === "shop") {
        return `
          <div class="stack card">
            <h2>Магазин сервера</h2>
            <p class="muted">Это поверх глобального шопа. Предмет с тем же ID заменяет мировой на этом сервере.</p>
            ${shopTable(shop, action, "Пока только глобальные предметы.")}
            ${shopEditor(action)}
          </div>`;
    }

    if (module === "commands") {
        const rows = (commands || []).map(item => `
          <tr>
            <td><code>${escapeHtml(item.name)}</code></td>
            <td>${escapeHtml(item.title || item.response || "").slice(0, 80)}</td>
            <td>
              <a class="btn ghost" href="/servers/${escapeHtml(guild.id)}/commands?edit=${escapeHtml(item.name)}">Редактор</a>
            </td>
            <td>
              <form method="post" action="${action}">
                <input type="hidden" name="op" value="delete">
                <input type="hidden" name="name" value="${escapeHtml(item.name)}">
                <button class="btn ghost" type="submit">Удалить</button>
              </form>
            </td>
          </tr>`).join("");
        return `
          <div class="stack">
            <div class="card">
              <h2>Свои команды</h2>
              <p class="muted">До 40 штук. Открывай редактор — там эмбед как у Juniper, не одна строка.</p>
              <table class="table">
                <thead><tr><th>Имя</th><th>Превью</th><th></th><th></th></tr></thead>
                <tbody>${rows || `<tr><td colspan="4" class="muted">Пока пусто.</td></tr>`}</tbody>
              </table>
            </div>
            ${commandEditor(guild, editCommand || {})}
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
    admin,
    guild,
    settings,
    channels = [],
    roles = [],
    commands = [],
    event = { enabled: false, channel: "", message: "" },
    shop = [],
    editCommand = null,
    module = "general",
    saved
}) {
    const current = MODULES.some(item => item.id === module) ? module : "general";
    const data = {
        prefix: true,
        prefixText: "!",
        autoroles: [],
        automodInvites: false,
        automodWords: "",
        disabledCommands: [],
        flipMax: 10000,
        flipMin: 10,
        payMax: 0,
        payMin: 1,
        robMin: 50,
        buyMax: 20,
        ...settings
    };
    const links = MODULES.map(item => {
        if (item.heading) {
            return `<div class="side-heading">${escapeHtml(item.heading)}</div>`;
        }
        return `
      <a class="${item.id === current ? "active" : ""}" href="/servers/${escapeHtml(guild.id)}/${item.id}">
        ${escapeHtml(item.title)}
      </a>`;
    }).join("");

    return layout({
        title: guild.name,
        user,
        admin,
        body: `
          <p class="muted"><a href="/servers">← Серверы</a></p>
          <h1>${escapeHtml(guild.name)}</h1>
          ${saved ? `<div class="flash">Сохранено.</div>` : ""}
          <div class="dash">
            <nav class="side">${links}</nav>
            <div>${moduleForm(current, guild, data, { channels, roles, commands, event, shop, editCommand })}</div>
          </div>
        `
    });
}

function economyPage({ user, admin, users = [], query = "", saved, error }) {
    const rows = users.map(item => `
      <tr>
        <td><code>${escapeHtml(item.id)}</code></td>
        <td>${escapeHtml(String(item.balance))}</td>
        <td>${escapeHtml(String(item.bank))}</td>
        <td>
          <form class="inline" method="post" action="/admin/economy">
            <input type="hidden" name="op" value="save">
            <input type="hidden" name="id" value="${escapeHtml(item.id)}">
            <input type="number" name="balance" value="${escapeHtml(String(item.balance))}" min="0">
            <input type="number" name="bank" value="${escapeHtml(String(item.bank))}" min="0">
            <button class="btn" type="submit">Ок</button>
          </form>
        </td>
      </tr>`).join("");

    return layout({
        title: "Экономика",
        user,
        admin,
        body: `
          <p class="muted"><a href="/servers">← Серверы</a></p>
          <h1>Экономика</h1>
          <p class="muted">Только владелец и высшие модераторы. Discord ID, наличные и банк.</p>
          ${saved ? `<div class="flash">Сохранено.</div>` : ""}
          ${error ? `<div class="warn">${escapeHtml(error)}</div>` : ""}
          <form class="row" method="get" action="/admin/economy">
            <input type="text" name="q" value="${escapeHtml(query)}" placeholder="Discord ID">
            <button class="btn" type="submit">Найти</button>
          </form>
          <div class="card" style="margin-top:20px">
            <table class="table">
              <thead><tr><th>ID</th><th>Наличные</th><th>Банк</th><th>Правка</th></tr></thead>
              <tbody>${rows || `<tr><td colspan="4" class="muted">Никого нет.</td></tr>`}</tbody>
            </table>
          </div>
          <form class="stack card" method="post" action="/admin/economy" style="margin-top:20px">
            <h2>Выдать или поставить</h2>
            <input type="hidden" name="op" value="save">
            <label><span>Discord ID</span>
              <input type="text" name="id" required>
            </label>
            <div class="split">
              <label><span>Наличные</span>
                <input type="number" name="balance" min="0" required>
              </label>
              <label><span>Банк</span>
                <input type="number" name="bank" min="0" value="0">
              </label>
            </div>
            <button class="btn" type="submit">Сохранить</button>
          </form>
        `
    });
}

function adminShopPage({ user, admin, items = [], saved, error }) {
    return layout({
        title: "Глобальный шоп",
        user,
        admin,
        body: `
          <p class="muted"><a href="/servers">← Серверы</a></p>
          <h1>Глобальный шоп</h1>
          <p class="muted">Виден на всех серверах. Серверный магазин может перекрыть ID.</p>
          ${saved ? `<div class="flash">Сохранено.</div>` : ""}
          ${error ? `<div class="warn">${escapeHtml(error)}</div>` : ""}
          <div class="card">
            ${shopTable(items, "/admin/shop", "Пусто.")}
            ${shopEditor("/admin/shop")}
          </div>
        `
    });
}

function errorPage({ user, admin, message, action }) {
    return layout({
        title: "Ошибка",
        user,
        admin,
        body: `<div class="warn">${escapeHtml(message)}</div>${action || `<p><a href="/">На главную</a></p>`}`
    });
}

module.exports = {
    MODULES,
    layout,
    homePage,
    serversPage,
    settingsPage,
    economyPage,
    adminShopPage,
    errorPage
};
