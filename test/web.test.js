const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("stream");
const fs = require("fs");
const os = require("os");
const path = require("path");
const economy = require("../Database/Economy");
const { handleRequest } = require("../Web/app");
const { createSession, cookieHeader, forgetMemory, getSession } = require("../Web/session");
const { inviteUrl, authorizeUrl } = require("../Web/oauth");
const { settingsPage } = require("../Web/html");

const GUILD_ID = "123456789012345678";
let dir;

function mockRes() {
    return {
        statusCode: 0,
        headers: {},
        body: "",
        headersSent: false,
        writeHead(status, headers = {}) {
            this.statusCode = status;
            this.headers = { ...this.headers, ...headers };
            this.headersSent = true;
        },
        end(body = "") {
            this.raw = body;
            this.body = Buffer.isBuffer(body) ? body.toString("utf8") : String(body);
        }
    };
}

function mockReq({ method = "GET", url = "/", headers = {}, body = "" } = {}) {
    const req = Readable.from([body]);
    req.method = method;
    req.url = url;
    req.headers = headers;
    return req;
}

function fakeClient(guildId = GUILD_ID) {
    const channels = new Map([
        ["111222333444555666", {
            id: "111222333444555666",
            name: "general",
            rawPosition: 1,
            isTextBased: () => true,
            isThread: () => false,
            isVoiceBased: () => false
        }],
        ["voice-1", {
            id: "voice-1",
            name: "voice",
            rawPosition: 0,
            isTextBased: () => true,
            isThread: () => false,
            isVoiceBased: () => true
        }]
    ]);
    const guild = {
        id: guildId,
        name: `Сервер <script>`,
        ownerId: "1",
        members: {
            cache: new Map([["1", {
                id: "1",
                permissions: { has: () => true }
            }]])
        },
        channels: { cache: channels }
    };
    return {
        user: {
            username: "BlackHole",
            displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/1.png"
        },
        guilds: {
            cache: new Map([[guildId, guild]])
        }
    };
}

async function sessionCookie(extra = {}) {
    const id = await createSession({
        user: { id: "1", username: "kit", global_name: "Kit" },
        guilds: [
            {
                id: GUILD_ID,
                name: "Сервер",
                owner: true,
                permissions: "0"
            },
            {
                id: "222333444555666777",
                name: "Без бота",
                owner: false,
                permissions: "32"
            },
            {
                id: "999888777666555444",
                name: "Чужой",
                owner: false,
                permissions: "0"
            }
        ],
        ...extra
    });
    return cookieHeader(id);
}

before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "blackhole-web-"));
    await economy.initDatabase(path.join(dir, "web.sqlite"));
});

after(async () => {
    await economy.closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
});

test("GET /health", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        url: "/health",
        headers: { cookie: "bh=dead" }
    }), res, fakeClient());
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).ok, true);
    assert.equal(res.headers["Content-Encoding"], undefined);
});

test("gzip html при Accept-Encoding", async () => {
    const zlib = require("zlib");
    const res = mockRes();
    await handleRequest(mockReq({
        url: "/",
        headers: { "accept-encoding": "gzip" }
    }), res, fakeClient());
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Content-Encoding"], "gzip");
    const raw = Buffer.isBuffer(res.raw) ? res.raw : Buffer.from(res.body);
    const text = zlib.gunzipSync(raw).toString("utf8");
    assert.match(text, /Панель бота/);
});

test("GET / отдаёт лендинг", async () => {
    const res = mockRes();
    await handleRequest(mockReq({ url: "/" }), res, fakeClient());
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Панель бота/);
    assert.match(res.body, /Войти через Discord/);
});

test("GET /style.css", async () => {
    const res = mockRes();
    await handleRequest(mockReq({ url: "/style.css" }), res, fakeClient());
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["Content-Type"], /text\/css/);
    assert.match(res.body, /--accent/);
});

test("GET /servers без сессии редиректит на логин", async () => {
    const res = mockRes();
    await handleRequest(mockReq({ url: "/servers" }), res, fakeClient());
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, "/login");
});

test("GET /servers показывает серверы, где есть права", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        url: "/servers",
        headers: { cookie: await sessionCookie() }
    }), res, fakeClient());
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Мои серверы/);
    assert.match(res.body, /Открыть/);
    assert.match(res.body, /Бота нет/);
    assert.match(res.body, /Без бота/);
    assert.doesNotMatch(res.body, /Чужой/);
});

test("GET /servers/:id редиректит в general", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        url: `/servers/${GUILD_ID}`,
        headers: { cookie: await sessionCookie() }
    }), res, fakeClient());
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, `/servers/${GUILD_ID}/general`);
});

test("GET /servers/:id/general форма и экранирование имени", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        url: `/servers/${GUILD_ID}/general`,
        headers: { cookie: await sessionCookie() }
    }), res, fakeClient());
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Сервер &lt;script&gt;/);
    assert.doesNotMatch(res.body, /Сервер <script>/);
    assert.match(res.body, /name="prefixText"/);
    assert.match(res.body, /Автороль/);
    assert.match(res.body, /Автомод/);
    assert.match(res.body, /Команды/);
    assert.match(res.body, /Ивенты/);
    assert.match(res.body, /Выйти/);
    assert.match(res.body, /XP за сообщения/);
    assert.match(res.body, /Кошельки/);
    assert.match(res.body, /Локальные работы/);
});

test("GET /servers/:id/join каналы без войса", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        url: `/servers/${GUILD_ID}/join`,
        headers: { cookie: await sessionCookie() }
    }), res, fakeClient());
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /#general/);
    assert.doesNotMatch(res.body, /#voice/);
    assert.match(res.body, /name="message"/);
    assert.match(res.body, /Вход/);
    assert.match(res.body, /data-tag="\{user\}"/);
});

test("POST /servers/:id/join сохраняет ивент отдельно", async () => {
    const res = mockRes();
    const body = new URLSearchParams({
        enabled: "1",
        channel: "111222333444555666",
        message: "Привет, {user}"
    }).toString();

    await handleRequest(mockReq({
        method: "POST",
        url: `/servers/${GUILD_ID}/join`,
        headers: {
            cookie: await sessionCookie(),
            "content-type": "application/x-www-form-urlencoded"
        },
        body
    }), res, fakeClient());

    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, `/servers/${GUILD_ID}/join?saved=1`);

    const event = await economy.getGuildEvent(GUILD_ID, "join");
    assert.equal(event.enabled, true);
    assert.equal(event.channel, "111222333444555666");
    assert.equal(event.message, "Привет, {user}");
});

test("POST /servers/:id/general не затирает welcome", async () => {
    await economy.saveGuildSettings(GUILD_ID, {
        welcomeOn: true,
        welcomeMessage: "не трогай"
    });
    const res = mockRes();
    await handleRequest(mockReq({
        method: "POST",
        url: `/servers/${GUILD_ID}/general`,
        headers: {
            cookie: await sessionCookie(),
            "content-type": "application/x-www-form-urlencoded"
        },
        body: "prefix=1&prefixText=%3F"
    }), res, fakeClient());

    const settings = await economy.getGuildSettings(GUILD_ID);
    assert.equal(settings.prefixText, "?");
    assert.equal(settings.welcomeMessage, "не трогай");
});

test("POST /servers/:id/commands добавляет кастом-команду", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        method: "POST",
        url: `/servers/${GUILD_ID}/custom`,
        headers: {
            cookie: await sessionCookie(),
            "content-type": "application/x-www-form-urlencoded"
        },
        body: "op=add&name=hi&response=Привет%2C+%7Buser%7D"
    }), res, fakeClient());

    assert.equal(res.statusCode, 302);
    const custom = await economy.getCustomCommand(GUILD_ID, "hi");
    assert.equal(custom.response, "Привет, {user}");
});

test("POST /servers/:id/commands сохраняет эмбед", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        method: "POST",
        url: `/servers/${GUILD_ID}/custom`,
        headers: {
            cookie: await sessionCookie(),
            "content-type": "application/x-www-form-urlencoded"
        },
        body: "op=save&name=rules&title=Правила&response=Читай%20чат&colorHex=%23ffaa00&footer=BH"
    }), res, fakeClient());

    const custom = await economy.getCustomCommand(GUILD_ID, "rules");
    assert.equal(custom.title, "Правила");
    assert.equal(custom.color, "#ffaa00");
    assert.equal(custom.footer, "BH");
});

test("POST /servers/:id/cmd выключает команду", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        method: "POST",
        url: `/servers/${GUILD_ID}/cmd/flip`,
        headers: {
            cookie: await sessionCookie(),
            "content-type": "application/x-www-form-urlencoded"
        },
        body: "enabled=0"
    }), res, fakeClient());

    assert.equal(res.statusCode, 302);
    const settings = await economy.getGuildSettings(GUILD_ID);
    assert.ok(settings.disabledCommands.includes("flip"));
});

test("GET /admin/economy без ранга — 403", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        url: "/admin/users",
        headers: { cookie: await sessionCookie({ user: { id: "99", username: "nope" } }) }
    }), res, fakeClient());
    assert.equal(res.statusCode, 403);
});

test("высший модер правит экономику и глобальный шоп", async () => {
    await economy.addStaff("1", "owner", 2);
    const cookie = await sessionCookie();

    const eco = mockRes();
    await handleRequest(mockReq({
        method: "POST",
        url: "/admin/users",
        headers: {
            cookie,
            "content-type": "application/x-www-form-urlencoded"
        },
        body: "id=123456789012345678&balance=900&bank=50"
    }), eco, fakeClient());
    assert.equal(eco.statusCode, 302);
    const user = await economy.getUser("123456789012345678");
    assert.equal(user.balance, 900);
    assert.equal(user.bank, 50);

    const shop = mockRes();
    await handleRequest(mockReq({
        method: "POST",
        url: "/admin/shop",
        headers: {
            cookie,
            "content-type": "application/x-www-form-urlencoded"
        },
        body: "op=save&id=star&name=Звезда&emoji=%E2%AD%90&price=12&description=тест"
    }), shop, fakeClient());
    assert.equal(shop.statusCode, 302);
    const item = await economy.getShopItem(null, "star");
    assert.equal(item.name, "Звезда");
    assert.equal(item.price, 12);
});

test("высший модер правит всемирные боксы и работы", async () => {
    await economy.addStaff("1", "owner", 2);
    const cookie = await sessionCookie();

    const box = mockRes();
    await handleRequest(mockReq({
        method: "POST",
        url: "/admin/boxes",
        headers: {
            cookie,
            "content-type": "application/x-www-form-urlencoded"
        },
        body: "op=save&id=box_neon&name=Неон&emoji=%F0%9F%93%A6&description=тест"
    }), box, fakeClient());
    assert.equal(box.statusCode, 302);
    const listed = await economy.listBoxes("global");
    assert.ok(listed.some(item => item.id === "box_neon"));

    const drop = mockRes();
    await handleRequest(mockReq({
        method: "POST",
        url: "/admin/boxes",
        headers: {
            cookie,
            "content-type": "application/x-www-form-urlencoded"
        },
        body: "op=save_drop&boxId=box_neon&kind=coins&weight=10&min=20&max=40"
    }), drop, fakeClient());
    assert.equal(drop.statusCode, 302);

    const page = mockRes();
    await handleRequest(mockReq({
        url: "/admin/boxes",
        headers: { cookie }
    }), page, fakeClient());
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /Неон/);
    assert.match(page.body, /монеты/);

    const jobs = mockRes();
    await handleRequest(mockReq({
        method: "POST",
        url: "/admin/jobs",
        headers: {
            cookie,
            "content-type": "application/x-www-form-urlencoded"
        },
        body: "op=save&id=baker&name=Пекарь&minLevel=2&mult=1.3"
    }), jobs, fakeClient());
    assert.equal(jobs.statusCode, 302);
    const catalog = await economy.listCatalog("global", "job");
    assert.ok(catalog.some(item => item.id === "baker"));
});

test("GET /servers/:id без прав — 403", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        url: "/servers/999888777666555444",
        headers: { cookie: await sessionCookie() }
    }), res, fakeClient());
    assert.equal(res.statusCode, 403);
    assert.match(res.body, /Нет прав/);
});

test("неизвестная страница — 404", async () => {
    const res = mockRes();
    await handleRequest(mockReq({ url: "/nope" }), res, fakeClient());
    assert.equal(res.statusCode, 404);
});

test("inviteUrl и authorizeUrl", () => {
    const invite = inviteUrl(GUILD_ID);
    assert.match(invite, /discord.com\/oauth2\/authorize/);
    assert.match(invite, new RegExp(`guild_id=${GUILD_ID}`));
    assert.match(invite, /bot/);

    const authorize = authorizeUrl({ headers: { host: "localhost:3000" } }, "abc123");
    assert.match(authorize, /oauth2\/authorize/);
    assert.match(authorize, /state=abc123/);
    assert.match(authorize, /identify/);
    assert.match(authorize, /guilds/);
});

test("settingsPage помечает сохранённое", () => {
    const html = settingsPage({
        user: { id: "1", username: "kit" },
        guild: { id: GUILD_ID, name: "Home" },
        settings: {
            prefix: true,
            prefixText: "!",
            welcomeOn: false,
            welcomeChannel: "",
            welcomeMessage: "",
            leaveMessage: ""
        },
        channels: [],
        saved: true
    });
    assert.match(html, /Сохранено/);
});

test("сессия живёт после очистки памяти — как рестарт Render", async () => {
    const id = await createSession({
        user: { id: "42", username: "stay" },
        guilds: [{ id: GUILD_ID, name: "Сервер", owner: true, permissions: "8" }]
    });
    forgetMemory();
    const restored = await getSession(id);
    assert.equal(restored.user.username, "stay");
    assert.equal(restored.id, id);
});

test("POST без прав в кэше бота — 403", async () => {
    const guildId = "555666777888999000";
    const cookie = await sessionCookie({
        user: { id: "77", username: "weak" },
        guilds: [{ id: guildId, name: "Weak", owner: false, permissions: "32" }]
    });
    const client = fakeClient(guildId);
    const guild = client.guilds.cache.get(guildId);
    guild.ownerId = "999";
    guild.members.cache.clear();
    const res = mockRes();
    await handleRequest(mockReq({
        method: "POST",
        url: `/servers/${guildId}/general`,
        headers: {
            cookie,
            "content-type": "application/x-www-form-urlencoded"
        },
        body: "prefix=1&prefixText=%21"
    }), res, client);
    assert.equal(res.statusCode, 403);
});

test("POST /cmd/daily пишет диапазон", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        method: "POST",
        url: `/servers/${GUILD_ID}/cmd/daily`,
        headers: {
            cookie: await sessionCookie(),
            "content-type": "application/x-www-form-urlencoded"
        },
        body: "enabled=1&dailyMin=10&dailyMax=20"
    }), res, fakeClient());
    assert.equal(res.statusCode, 302);
    const settings = await economy.getGuildSettings(GUILD_ID);
    assert.equal(settings.dailyMin, 10);
    assert.equal(settings.dailyMax, 20);
    assert.equal(settings.disabledCommands.includes("daily"), false);
});

test("GET /servers/:id/boxes конструктор дропа", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        url: `/servers/${GUILD_ID}/boxes`,
        headers: { cookie: await sessionCookie() }
    }), res, fakeClient());
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Боксы сервера/);
    assert.match(res.body, /Новый бокс/);
});

test("POST автомода пишет тумблеры и штрафы", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        method: "POST",
        url: `/servers/${GUILD_ID}/automod`,
        headers: {
            cookie: await sessionCookie(),
            "content-type": "application/x-www-form-urlencoded"
        },
        body: "automodLinks=0&automodLinks=1&automodSpam=0&automodSwear=0&automodSwear=1&automodCaps=0&automodFineLinks=40&automodFineSpam=0&automodFineSwear=12&automodFineCaps=0&automodWords=дурак"
    }), res, fakeClient());
    assert.equal(res.statusCode, 302);
    const settings = await economy.getGuildSettings(GUILD_ID);
    assert.equal(settings.automodLinks, true);
    assert.equal(settings.automodSwear, true);
    assert.equal(settings.automodSpam, false);
    assert.equal(settings.automodFineLinks, 40);
    assert.equal(settings.automodFineSwear, 12);
    assert.match(settings.automodWords, /дурак/);
});

test("GET timeout ивент есть", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        url: `/servers/${GUILD_ID}/timeout`,
        headers: { cookie: await sessionCookie() }
    }), res, fakeClient());
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Таймаут/);
});

test("панель справа и теги с пояснением", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        url: `/servers/${GUILD_ID}/custom`,
        headers: { cookie: await sessionCookie() }
    }), res, fakeClient());
    assert.match(res.body, /class="side"/);
    assert.match(res.body, /Кастомные/);
    assert.match(res.body, /Пинг человека/);
    assert.match(res.body, /data-panel/);
});
