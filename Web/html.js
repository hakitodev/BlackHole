const { escapeHtml } = require("./access");
const { inviteUrl } = require("./oauth");
const { EVENT_TYPES } = require("../Utils/events");
const { COMMANDS, RANGES } = require("../Utils/commands");
const { tagsFor } = require("../Utils/placeholders");
const { toHex } = require("../Utils/color");

const GUILD_TABS = [
    { id: "general", title: "Общие" },
    { id: "autorole", title: "Автороль" },
    { id: "automod", title: "Автомод" },
    { id: "shop", title: "Магаз сервера" },
    { id: "jobs", title: "Работы" },
    { id: "biz", title: "Бизнесы" }
];

const MODULES = [
    ...GUILD_TABS,
    { heading: "Ивенты" },
    ...EVENT_TYPES.map(item => ({
        id: item.id,
        title: item.title,
        event: true,
        hint: item.hint,
        fallback: item.fallback
    }))
];

function botBrand(bot) {
    const name = bot?.name || "BlackHole";
    const avatar = bot?.avatar || "";
    const icon = avatar
        ? `<img class="logo" src="${escapeHtml(avatar)}" alt="">`
        : `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="#111" stroke="#e10600" stroke-width="2"/>
        <circle cx="16" cy="16" r="6" fill="#f5f5f5"/>
        <circle cx="16" cy="16" r="2.5" fill="#0a0a0a"/>
      </svg>`;
    return `${icon}${escapeHtml(name)}`;
}

function navLink(href, label, active) {
    return `<a class="${active ? "active" : ""}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function accordion(title, inner, open) {
    return `<details class="acc" ${open ? "open" : ""}><summary>${escapeHtml(title)}</summary>${inner}</details>`;
}

function sideNav({
    user,
    admin,
    guild,
    module = "",
    cmdName = "",
    customName = "",
    custom = [],
    path = ""
}) {
    if (!user) {
        return "";
    }

    const bits = [];
    bits.push(navLink("/servers", "Серверы", path === "/servers" && !guild));

    if (guild) {
        bits.push(accordion("Сервер", GUILD_TABS.map(item =>
            navLink(`/servers/${guild.id}/${item.id}`, item.title, module === item.id)
        ).join(""), ["general", "autorole", "automod", "shop", "jobs", "biz"].includes(module)));

        bits.push(accordion("Команды", COMMANDS.map(item =>
            navLink(
                `/servers/${guild.id}/cmd/${item.id}`,
                item.title,
                module === "cmd" && cmdName === item.id
            )
        ).join(""), module === "cmd"));

        bits.push(accordion("Кастомные", [
            navLink(`/servers/${guild.id}/custom`, "+ новая", module === "custom" && !customName),
            ...custom.map(item => navLink(
                `/servers/${guild.id}/custom/${item.name}`,
                item.name,
                module === "custom" && customName === item.name
            ))
        ].join(""), module === "custom"));

        bits.push(accordion("Ивенты", EVENT_TYPES.map(item =>
            navLink(`/servers/${guild.id}/${item.id}`, item.title, module === item.id)
        ).join(""), Boolean(EVENT_TYPES.some(item => item.id === module))));
    }

    if (admin) {
        bits.push(accordion("Админ", [
            navLink("/admin/users", "Юзеры", path === "/admin/users"),
            navLink("/admin/shop", "Всемирный шоп", path === "/admin/shop")
        ].join(""), path.startsWith("/admin")));
    }

    bits.push(navLink("/logout", "Выйти", false));
    return `
      <aside class="side" id="panel">
        <button class="panel-close" type="button" data-panel-close>Закрыть</button>
        <nav>${bits.join("")}</nav>
      </aside>`;
}

function layout({
    title,
    user,
    admin,
    bot,
    guild,
    module,
    cmdName,
    customName,
    custom,
    path,
    body
}) {
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
      ${botBrand(bot)}
    </a>
    <nav class="nav">
      ${user ? `
        <span class="user">
          ${user.avatar ? `<img src="${escapeHtml(avatar)}" alt="">` : ""}
          ${escapeHtml(user.global_name || user.username)}
        </span>
        <button class="menu-btn" type="button" data-panel>Меню</button>
      ` : `<a class="btn discord" href="/login">Войти через Discord</a>`}
    </nav>
  </header>
  <main class="${user ? "shell" : "wrap"}">
    <div class="${user ? "content" : ""}">
      ${body}
    </div>
    ${sideNav({ user, admin, guild, module, cmdName, customName, custom, path })}
  </main>
  <script src="/editor.js"></script>
</body>
</html>`;
}

function homePage({ user, configured, admin, bot }) {
    return layout({
        title: "Панель",
        user,
        admin,
        bot,
        path: "/",
        body: `
          <section class="hero">
            <h1>Панель бота</h1>
            <div class="row">
              ${configured
                ? (user
                    ? `<a class="btn" href="/servers">Мои серверы</a>`
                    : `<a class="btn discord" href="/login">Войти через Discord</a>`)
                : `<div class="warn">В env нужны <code>CLIENT_SECRET</code> и <code>PUBLIC_URL</code>.</div>`}
              <a class="btn ghost" href="${escapeHtml(inviteUrl())}">Добавить на сервер</a>
            </div>
          </section>
        `
    });
}

function serversPage({ user, guilds, admin, bot }) {
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
                <div class="tag">${guild.bot ? "Открыть" : "Бота нет"}</div>
              </div>
            </div>
          </a>
        `;
    }).join("");

    return layout({
        title: "Серверы",
        user,
        admin,
        bot,
        path: "/servers",
        body: `
          <h1>Мои серверы</h1>
          <div class="grid" style="margin-top:20px">
            ${cards || `<div class="card">Нет серверов с правами.</div>`}
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

function tagBar(kind, eventType) {
    const tags = tagsFor(kind, eventType);
    if (!tags.length) {
        return "";
    }
    return `
      <div class="tags">
        ${tags.map(item =>
            `<button type="button" class="tag-chip" data-tag="${escapeHtml(item.tag)}">
               <code>${escapeHtml(item.tag)}</code>
               <span>${escapeHtml(item.hint)}</span>
             </button>`
        ).join("")}
      </div>
    `;
}

function livePreview(bot) {
    return `
      <div id="live-preview" class="live-preview"
           data-bot-name="${escapeHtml(bot?.name || "BlackHole")}"
           data-bot-avatar="${escapeHtml(bot?.avatar || "")}"></div>
    `;
}

function eventForm(type, guild, event, channels, bot) {
    const action = `/servers/${escapeHtml(guild.id)}/${escapeHtml(type.id)}`;
    return `
      <form class="stack card" method="post" action="${action}" data-editor>
        <h2>${escapeHtml(type.title)}</h2>
        <input type="hidden" name="enabled" value="0">
        <label class="switch">
          <input type="checkbox" name="enabled" value="1" ${event.enabled ? "checked" : ""}>
          Включить
        </label>
        <label><span>Канал</span>
          <select name="channel">${channelOptions(channels, event.channel)}</select>
        </label>
        ${tagBar("event", type)}
        <label><span>Текст</span>
          <textarea name="message">${escapeHtml(event.message || "")}</textarea>
        </label>
        ${livePreview(bot)}
        <button class="btn" type="submit">Сохранить</button>
      </form>`;
}

function shopTable(items, action, empty) {
    const rows = (items || []).map(item => `
      <tr>
        <td>${escapeHtml(item.emoji)} <code>${escapeHtml(item.id)}</code></td>
        <td>${escapeHtml(item.name)}${item.kind === "role" ? " · роль" : ""}</td>
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

function shopEditor(action) {
    return `
      <form class="stack" method="post" action="${action}">
        <input type="hidden" name="op" value="save">
        <div class="split">
          <label><span>ID латиницей</span>
            <input type="text" name="id" placeholder="coffee">
          </label>
          <label><span>Эмодзи</span>
            <input type="text" name="emoji" placeholder="☕">
          </label>
        </div>
        <label><span>Название</span>
          <input type="text" name="name" placeholder="Кофе">
        </label>
        <label><span>Цена</span>
          <input type="number" name="price" min="0" value="100">
        </label>
        <label><span>Тип</span>
          <select name="kind">
            <option value="item">Предмет</option>
            <option value="role">Цветная роль</option>
          </select>
        </label>
        <label><span>HEX роли</span>
          <input type="text" name="hex" placeholder="#ff0055">
        </label>
        <label><span>Описание</span>
          <textarea name="description"></textarea>
        </label>
        <button class="btn" type="submit">Сохранить предмет</button>
      </form>`;
}

function commandEditor(guild, command = {}, bot) {
    const name = command.name || "";
    const action = name
        ? `/servers/${escapeHtml(guild.id)}/custom/${escapeHtml(name)}`
        : `/servers/${escapeHtml(guild.id)}/custom`;
    const color = toHex(command.color);
    return `
      <form class="stack card embed-editor" method="post" action="${action}" data-editor>
        <h2>${name ? escapeHtml(name) : "Новая команда"}</h2>
        <input type="hidden" name="op" value="save">
        <label><span>Имя</span>
          <input type="text" name="name" value="${escapeHtml(name)}" ${name ? "readonly" : ""} placeholder="hi" required>
        </label>
        ${tagBar("custom")}
        <label><span>Текст над эмбедом</span>
          <textarea name="content">${escapeHtml(command.content || "")}</textarea>
        </label>
        <label><span>Автор</span>
          <input type="text" name="author" value="${escapeHtml(command.author || "")}">
        </label>
        <label><span>Иконка автора URL</span>
          <input type="text" name="authorIcon" value="${escapeHtml(command.authorIcon || "")}" placeholder="https://">
        </label>
        <label><span>Заголовок</span>
          <input type="text" name="title" value="${escapeHtml(command.title || "")}">
        </label>
        <label><span>Ссылка заголовка</span>
          <input type="text" name="url" value="${escapeHtml(command.url || "")}" placeholder="https://">
        </label>
        <label><span>Описание</span>
          <textarea name="response" class="md">${escapeHtml(command.response || "")}</textarea>
        </label>
        <div class="split">
          <label><span>Цвет</span>
            <input type="color" name="color" value="${escapeHtml(color)}">
          </label>
          <label><span>HEX</span>
            <input type="text" name="colorHex" value="${escapeHtml(color)}">
          </label>
        </div>
        <label><span>Картинка URL</span>
          <input type="text" name="image" value="${escapeHtml(command.image || "")}" placeholder="https://">
        </label>
        <label><span>Превью справа URL</span>
          <input type="text" name="thumbnail" value="${escapeHtml(command.thumbnail || "")}" placeholder="https://">
        </label>
        <label><span>Поля. Строка: имя | значение | inline</span>
          <textarea name="fields" placeholder="Правило | не спамь | inline">${escapeHtml(command.fields || "")}</textarea>
        </label>
        <label><span>Футер</span>
          <input type="text" name="footer" value="${escapeHtml(command.footer || "")}">
        </label>
        <label><span>Иконка футера URL</span>
          <input type="text" name="footerIcon" value="${escapeHtml(command.footerIcon || "")}" placeholder="https://">
        </label>
        <input type="hidden" name="timestamp" value="0">
        <label class="switch">
          <input type="checkbox" name="timestamp" value="1" ${command.timestamp ? "checked" : ""}>
          Время внизу
        </label>
        ${livePreview(bot)}
        <button class="btn" type="submit">${name ? "Сохранить" : "Создать"}</button>
      </form>`;
}

function catalogTable(items, action, kind) {
    const extra = kind === "job" ? "Ур. / ×" : "Цена / доход";
    const rows = (items || []).map(item => `
      <tr>
        <td><code>${escapeHtml(item.id)}</code></td>
        <td>${escapeHtml(item.emoji || "")} ${escapeHtml(item.name)}</td>
        <td>${kind === "job"
            ? `${escapeHtml(String(item.minLevel || 1))} / ×${escapeHtml(String(item.mult || 1))}`
            : `${escapeHtml(String(item.price || 0))} / ${escapeHtml(String(item.income || 0))}`}</td>
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
        <thead><tr><th>ID</th><th>Название</th><th>${extra}</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="muted">Пока пусто.</td></tr>`}</tbody>
      </table>`;
}

function catalogEditor(kind, action) {
    if (kind === "job") {
        return `
          <form class="stack" method="post" action="${action}">
            <input type="hidden" name="op" value="save">
            <div class="split">
              <label><span>ID латиницей</span><input type="text" name="id" placeholder="baker" required></label>
              <label><span>Название</span><input type="text" name="name" placeholder="Пекарь" required></label>
            </div>
            <div class="split">
              <label><span>Мин. уровень</span><input type="number" name="minLevel" min="1" value="1"></label>
              <label><span>Множитель зарплаты</span><input type="number" name="mult" min="0.1" step="0.1" value="1.2"></label>
            </div>
            <button class="btn" type="submit">Сохранить работу</button>
          </form>`;
    }
    return `
      <form class="stack" method="post" action="${action}">
        <input type="hidden" name="op" value="save">
        <div class="split">
          <label><span>ID латиницей</span><input type="text" name="id" placeholder="garage" required></label>
          <label><span>Эмодзи</span><input type="text" name="emoji" placeholder="🛠️"></label>
        </div>
        <label><span>Название</span><input type="text" name="name" placeholder="Гараж" required></label>
        <div class="split">
          <label><span>Цена</span><input type="number" name="price" min="0" value="10000"></label>
          <label><span>Доход / мин</span><input type="number" name="income" min="0" value="20"></label>
        </div>
        <div class="split">
          <label><span>Кап</span><input type="number" name="cap" min="1" value="4000"></label>
          <label><span>Макс ур.</span><input type="number" name="maxLevel" min="1" value="10"></label>
        </div>
        <button class="btn" type="submit">Сохранить бизнес</button>
      </form>`;
}

function switchField(name, checked, label) {
    return `
      <input type="hidden" name="${escapeHtml(name)}" value="0">
      <label class="switch">
        <input type="checkbox" name="${escapeHtml(name)}" value="1" ${checked ? "checked" : ""}>
        ${escapeHtml(label)}
      </label>`;
}

function eventModule(id) {
    return EVENT_TYPES.find(item => item.id === id) || null;
}

function moduleForm(module, guild, settings, extras) {
    const action = `/servers/${escapeHtml(guild.id)}/${module}`;
    const {
        channels = [],
        roles = [],
        shop = [],
        bot
    } = extras;

    const eventType = eventModule(module);
    if (eventType) {
        return eventForm(eventType, guild, extras.event || { enabled: false, channel: "", message: "" }, channels, bot);
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
            : `<p class="muted">Нет ролей ниже роли бота.</p>`;
        return `
          <form class="stack card" method="post" action="${action}">
            <h2>Автороль</h2>
            ${boxes}
            <button class="btn" type="submit">Сохранить</button>
          </form>`;
    }

    if (module === "automod") {
        return `
          <form class="stack card" method="post" action="${action}">
            <h2>Автомод</h2>
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

    if (module === "shop") {
        return `
          <div class="stack card">
            <h2>Магаз сервера</h2>
            ${shopTable(shop, action, "Пока пусто.")}
            ${shopEditor(action)}
          </div>`;
    }

    if (module === "jobs") {
        return `
          <div class="stack card">
            <h2>Локальные работы</h2>
            ${catalogTable(extras.jobs || [], action, "job")}
            ${catalogEditor("job", action)}
          </div>`;
    }

    if (module === "biz") {
        return `
          <div class="stack card">
            <h2>Локальные бизнесы</h2>
            ${catalogTable(extras.businesses || [], action, "biz")}
            ${catalogEditor("biz", action)}
          </div>`;
    }

    return `
      <form class="stack card" method="post" action="${action}">
        <h2>Общие</h2>
        ${switchField("prefix", settings.prefix, "Префикс-команды")}
        <label><span>Префикс</span>
          <input type="text" name="prefixText" maxlength="8" value="${escapeHtml(settings.prefixText)}">
        </label>
        ${switchField("xpOn", settings.xpOn, "XP за сообщения")}
        <label><span>Монет за новый уровень</span>
          <input type="number" name="levelMoney" min="0" value="${escapeHtml(String(settings.levelMoney ?? 250))}">
        </label>
        <h3>Экономика</h3>
        <label><span>Кошельки</span>
          <select name="walletScope">
            <option value="global" ${settings.walletScope !== "guild" ? "selected" : ""}>Всемирная</option>
            <option value="guild" ${settings.walletScope === "guild" ? "selected" : ""}>Гильдийная</option>
          </select>
        </label>
        ${switchField("economyOn", settings.economyOn !== false, "Команды экономики")}
        ${switchField("earnOn", settings.earnOn !== false, "Получение денег")}
        ${switchField("jobsGlobal", settings.jobsGlobal !== false, "Всемирные работы")}
        ${switchField("jobsGuild", settings.jobsGuild, "Локальные работы")}
        ${switchField("bizGlobal", settings.bizGlobal !== false, "Всемирные бизнесы")}
        ${switchField("bizGuild", settings.bizGuild, "Локальные бизнесы")}
        ${switchField("shopGlobal", settings.shopGlobal !== false, "Всемирный магазин")}
        ${switchField("shopGuild", settings.shopGuild !== false, "Магазин сервера")}
        ${switchField("penaltiesOn", settings.penaltiesOn !== false, "Штрафы за простой")}
        ${extras.owner ? switchField("paused", settings.paused, "Пауза бота на этом сервере") : ""}
        <button class="btn" type="submit">Сохранить</button>
      </form>`;
}

function rangeFields(name, settings) {
    const fields = RANGES[name];
    if (!fields) {
        return "";
    }
    const pairs = [];
    for (let i = 0; i < fields.length; i += 2) {
        const a = fields[i];
        const b = fields[i + 1];
        pairs.push(`
          <div class="split">
            <label><span>${escapeHtml(a.label)}</span>
              <input type="number" name="${escapeHtml(a.key)}" min="0" value="${escapeHtml(String(settings[a.key] ?? 0))}">
            </label>
            ${b ? `<label><span>${escapeHtml(b.label)}</span>
              <input type="number" name="${escapeHtml(b.key)}" min="0" value="${escapeHtml(String(settings[b.key] ?? 0))}">
            </label>` : ""}
          </div>`);
    }
    return pairs.join("");
}

function cmdPage({ guild, name, enabled, settings = {} }) {
    return `
      <form class="stack card" method="post" action="/servers/${escapeHtml(guild.id)}/cmd/${escapeHtml(name)}">
        <h2>/${escapeHtml(name)}</h2>
        <input type="hidden" name="enabled" value="0">
        <label class="switch">
          <input type="checkbox" name="enabled" value="1" ${enabled ? "checked" : ""}>
          Включена
        </label>
        ${rangeFields(name, settings)}
        <button class="btn" type="submit">Сохранить</button>
      </form>`;
}

function settingsPage(opts) {
    const {
        user,
        admin,
        bot,
        guild,
        settings,
        channels = [],
        roles = [],
        custom = [],
        event,
        shop = [],
        jobs = [],
        businesses = [],
        owner = false,
        editCommand = null,
        module = "general",
        cmdName = "",
        customName = "",
        saved
    } = opts;

    const data = {
        prefix: true,
        prefixText: "!",
        autoroles: [],
        automodInvites: false,
        automodWords: "",
        disabledCommands: [],
        xpOn: true,
        levelMoney: 250,
        dailyMin: 300,
        dailyMax: 1100,
        workMin: 70,
        workMax: 260,
        crimeMin: 180,
        crimeMax: 480,
        crimeFineMin: 80,
        crimeFineMax: 220,
        ...settings
    };

    let inner;
    if (module === "cmd") {
        inner = cmdPage({
            guild,
            name: cmdName,
            enabled: !data.disabledCommands.includes(cmdName),
            settings: data
        });
    } else if (module === "custom") {
        inner = commandEditor(guild, editCommand || { name: customName }, bot);
        if (customName) {
            inner += `
              <form method="post" action="/servers/${escapeHtml(guild.id)}/custom/${escapeHtml(customName)}" style="margin-top:12px">
                <input type="hidden" name="op" value="delete">
                <input type="hidden" name="name" value="${escapeHtml(customName)}">
                <button class="btn ghost" type="submit">Удалить команду</button>
              </form>`;
        }
    } else {
        inner = moduleForm(module, guild, data, { channels, roles, shop, jobs, businesses, event, bot, owner });
    }

    return layout({
        title: guild.name,
        user,
        admin,
        bot,
        guild,
        module,
        cmdName,
        customName,
        custom,
        body: `
          <h1>${escapeHtml(guild.name)}</h1>
          ${saved ? `<div class="flash">Сохранено.</div>` : ""}
          ${inner}
        `
    });
}

function userLabel(item) {
    const name = item.username || "";
    return name
        ? `${escapeHtml(name)} <div class="muted"><code>${escapeHtml(item.id)}</code></div>`
        : `<code>${escapeHtml(item.id)}</code>`;
}

function usersPage({ user, admin, bot, users = [], current, inventory = [], query = "", saved, error }) {
    const rows = users.map(item => `
      <tr>
        <td><a href="/admin/users?q=${escapeHtml(item.id)}">${userLabel(item)}</a></td>
        <td>${escapeHtml(String(item.balance))}</td>
        <td>${escapeHtml(String(item.bank))}</td>
        <td>${escapeHtml(String(item.btc || 0))}</td>
        <td>${escapeHtml(String(item.level))}</td>
        <td>${escapeHtml(String(item.xp))}</td>
      </tr>`).join("");

    const invRows = inventory.map(item => `
      <tr>
        <td><code>${escapeHtml(item.item_id)}</code></td>
        <td>${escapeHtml(String(item.qty))}</td>
        <td>
          <form class="inline" method="post" action="/admin/users">
            <input type="hidden" name="op" value="inv">
            <input type="hidden" name="id" value="${escapeHtml(current.id)}">
            <input type="hidden" name="item" value="${escapeHtml(item.item_id)}">
            <input type="number" name="qty" value="${escapeHtml(String(item.qty))}" min="0">
            <button class="btn" type="submit">Ок</button>
          </form>
        </td>
      </tr>`).join("");

    const heading = current
        ? (current.username ? `${escapeHtml(current.username)}` : escapeHtml(current.id))
        : "";

    return layout({
        title: "Юзеры",
        user,
        admin,
        bot,
        path: "/admin/users",
        body: `
          <h1>Юзеры</h1>
          ${saved ? `<div class="flash">Сохранено.</div>` : ""}
          ${error ? `<div class="warn">${escapeHtml(error)}</div>` : ""}
          <form class="row" method="get" action="/admin/users">
            <input type="text" name="q" value="${escapeHtml(query)}" placeholder="Имя или ID">
            <button class="btn" type="submit">Найти</button>
          </form>
          <div class="card" style="margin-top:20px">
            <table class="table">
              <thead><tr><th>Юзер</th><th>Нал</th><th>Банк</th><th>BTC</th><th>Лвл</th><th>XP</th></tr></thead>
              <tbody>${rows || `<tr><td colspan="6" class="muted">Никого нет.</td></tr>`}</tbody>
            </table>
          </div>
          ${current ? `
            <form class="stack card" method="post" action="/admin/users" style="margin-top:20px">
              <h2>${heading}</h2>
              <input type="hidden" name="op" value="save">
              <input type="hidden" name="id" value="${escapeHtml(current.id)}">
              <div class="split">
                <label><span>Наличные</span><input type="number" name="balance" min="0" value="${escapeHtml(String(current.balance))}"></label>
                <label><span>Банк</span><input type="number" name="bank" min="0" value="${escapeHtml(String(current.bank))}"></label>
              </div>
              <div class="split">
                <label><span>BTC</span><input type="number" name="btc" min="0" value="${escapeHtml(String(current.btc || 0))}"></label>
                <label><span>Профессия</span><input type="text" name="job" value="${escapeHtml(current.job || "")}"></label>
              </div>
              <div class="split">
                <label><span>Уровень</span><input type="number" name="level" min="1" value="${escapeHtml(String(current.level))}"></label>
                <label><span>XP</span><input type="number" name="xp" min="0" value="${escapeHtml(String(current.xp))}"></label>
              </div>
              <button class="btn" type="submit">Сохранить</button>
            </form>
            <form method="post" action="/admin/users" style="margin-top:12px">
              <input type="hidden" name="op" value="reset">
              <input type="hidden" name="id" value="${escapeHtml(current.id)}">
              <button class="btn ghost" type="submit">Сбросить кулдауны</button>
            </form>
            <form method="post" action="/admin/users" style="margin-top:8px">
              <input type="hidden" name="op" value="delete">
              <input type="hidden" name="id" value="${escapeHtml(current.id)}">
              <button class="btn ghost" type="submit">Удалить юзера</button>
            </form>
            <div class="card" style="margin-top:20px">
              <h2>Инвентарь</h2>
              <table class="table">
                <thead><tr><th>Предмет</th><th>Кол-во</th><th></th></tr></thead>
                <tbody>${invRows || `<tr><td colspan="3" class="muted">Пусто.</td></tr>`}</tbody>
              </table>
              <form class="stack" method="post" action="/admin/users" style="margin-top:12px">
                <input type="hidden" name="op" value="inv">
                <input type="hidden" name="id" value="${escapeHtml(current.id)}">
                <div class="split">
                  <label><span>ID предмета</span><input type="text" name="item" required></label>
                  <label><span>Кол-во, 0 — убрать</span><input type="number" name="qty" min="0" value="1"></label>
                </div>
                <button class="btn" type="submit">Поставить</button>
              </form>
            </div>
          ` : `
            <form class="stack card" method="post" action="/admin/users" style="margin-top:20px">
              <h2>Открыть / создать</h2>
              <input type="hidden" name="op" value="save">
              <label><span>Discord ID</span><input type="text" name="id" required></label>
              <div class="split">
                <label><span>Наличные</span><input type="number" name="balance" min="0" value="0"></label>
                <label><span>Банк</span><input type="number" name="bank" min="0" value="0"></label>
              </div>
              <div class="split">
                <label><span>Уровень</span><input type="number" name="level" min="1" value="1"></label>
                <label><span>XP</span><input type="number" name="xp" min="0" value="0"></label>
              </div>
              <button class="btn" type="submit">Сохранить</button>
            </form>
          `}
        `
    });
}

function adminShopPage({ user, admin, bot, items = [], saved, error }) {
    return layout({
        title: "Всемирный шоп",
        user,
        admin,
        bot,
        path: "/admin/shop",
        body: `
          <h1>Всемирный шоп</h1>
          ${saved ? `<div class="flash">Сохранено.</div>` : ""}
          ${error ? `<div class="warn">${escapeHtml(error)}</div>` : ""}
          <div class="card">
            ${shopTable(items, "/admin/shop", "Пусто.")}
            ${shopEditor("/admin/shop")}
          </div>
        `
    });
}

function errorPage({ user, admin, bot, guild, custom, message, action }) {
    return layout({
        title: "Ошибка",
        user,
        admin,
        bot,
        guild,
        custom,
        body: `<div class="warn">${escapeHtml(message)}</div>${action || `<p><a href="/">На главную</a></p>`}`
    });
}

module.exports = {
    MODULES,
    layout,
    homePage,
    serversPage,
    settingsPage,
    usersPage,
    economyPage: usersPage,
    adminShopPage,
    errorPage
};
