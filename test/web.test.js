const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("stream");
const fs = require("fs");
const os = require("os");
const path = require("path");
const economy = require("../Database/Economy");
const { handleRequest } = require("../Web/app");
const { createSession, cookieHeader } = require("../Web/session");
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
            this.body = String(body);
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
        channels: { cache: channels }
    };
    return {
        guilds: {
            cache: new Map([[guildId, guild]])
        }
    };
}

function sessionCookie(extra = {}) {
    const id = createSession({
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
    await handleRequest(mockReq({ url: "/health" }), res, fakeClient());
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).ok, true);
});

test("GET / отдаёт лендинг", async () => {
    const res = mockRes();
    await handleRequest(mockReq({ url: "/" }), res, fakeClient());
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Настрой бота с сайта/);
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
        headers: { cookie: sessionCookie() }
    }), res, fakeClient());
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Мои серверы/);
    assert.match(res.body, /Открыть настройки/);
    assert.match(res.body, /Бот ещё не на сервере/);
    assert.match(res.body, /Без бота/);
    assert.doesNotMatch(res.body, /Чужой/);
});

test("GET /servers/:id форма настроек и экранирование имени", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        url: `/servers/${GUILD_ID}`,
        headers: { cookie: sessionCookie() }
    }), res, fakeClient());
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Сервер &lt;script&gt;/);
    assert.doesNotMatch(res.body, /<script>/);
    assert.match(res.body, /#general/);
    assert.doesNotMatch(res.body, /#voice/);
    assert.match(res.body, /name="prefixText"/);
    assert.match(res.body, /name="welcomeMessage"/);
});

test("POST /servers/:id сохраняет настройки", async () => {
    const res = mockRes();
    const body = new URLSearchParams({
        prefix: "1",
        prefixText: "?",
        welcomeOn: "1",
        welcomeChannel: "111222333444555666",
        welcomeMessage: "Привет, {user}",
        leaveMessage: "Пока"
    }).toString();

    await handleRequest(mockReq({
        method: "POST",
        url: `/servers/${GUILD_ID}`,
        headers: {
            cookie: sessionCookie(),
            "content-type": "application/x-www-form-urlencoded"
        },
        body
    }), res, fakeClient());

    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, `/servers/${GUILD_ID}?saved=1`);

    const settings = await economy.getGuildSettings(GUILD_ID);
    assert.equal(settings.prefixText, "?");
    assert.equal(settings.welcomeOn, true);
    assert.equal(settings.welcomeChannel, "111222333444555666");
    assert.equal(settings.welcomeMessage, "Привет, {user}");
    assert.equal(settings.leaveMessage, "Пока");
});

test("GET /servers/:id без прав — 403", async () => {
    const res = mockRes();
    await handleRequest(mockReq({
        url: "/servers/999888777666555444",
        headers: { cookie: sessionCookie() }
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
