const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { CLIENT_ID, CLIENT_SECRET } = require("../Config");
const economy = require("../Database/Economy");
const { canManageGuild, parseForm, escapeHtml } = require("./access");
const {
    createSession,
    destroySession,
    cookieHeader,
    clearCookieHeader,
    sessionFromRequest,
    parseCookies
} = require("./session");
const { authorizeUrl, exchangeCode, discordGet, inviteUrl } = require("./oauth");
const { homePage, serversPage, settingsPage, errorPage } = require("./html");

const STYLE = fs.readFileSync(path.join(__dirname, "style.css"), "utf8");
const oauthStates = new Map();
const STATE_TTL = 10 * 60 * 1000;

function send(res, status, body, headers = {}) {
    res.writeHead(status, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        ...headers
    });
    res.end(body);
}

function rememberOauthState(state) {
    const now = Date.now();
    for (const [key, created] of oauthStates) {
        if (now - created > STATE_TTL) {
            oauthStates.delete(key);
        }
    }
    oauthStates.set(state, now);
}

function redirect(res, location, headers = {}) {
    res.writeHead(302, { Location: location, ...headers });
    res.end();
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on("data", chunk => {
            size += chunk.length;
            if (size > 65536) {
                reject(new Error("too large"));
                req.destroy();
                return;
            }
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}

function managedGuilds(session) {
    return (session.guilds || []).filter(guild =>
        canManageGuild(guild.permissions, guild.owner)
    );
}

function findManaged(session, guildId) {
    return managedGuilds(session).find(guild => guild.id === guildId) || null;
}

function withBotFlag(client, guilds) {
    const present = client.guilds?.cache ?? new Map();
    return guilds.map(guild => ({
        ...guild,
        bot: present.has(guild.id)
    }));
}

function textChannels(guild) {
    return [...guild.channels.cache.values()]
        .filter(channel => channel.isTextBased?.() && !channel.isThread?.() && !channel.isVoiceBased?.())
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map(channel => ({ id: channel.id, name: channel.name }));
}

async function handleRequest(req, res, client) {
    const url = new URL(req.url, "http://localhost");
    const session = sessionFromRequest(req);
    const user = session?.user ?? null;

    if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
    }

    if (url.pathname === "/style.css") {
        res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
        res.end(STYLE);
        return;
    }

    if (url.pathname === "/") {
        send(res, 200, homePage({ user, configured: Boolean(CLIENT_ID && CLIENT_SECRET) }));
        return;
    }

    if (url.pathname === "/login") {
        if (!CLIENT_ID || !CLIENT_SECRET) {
            send(res, 500, errorPage({ user, message: "Задай CLIENT_ID, CLIENT_SECRET и PUBLIC_URL." }));
            return;
        }
        const state = crypto.randomBytes(16).toString("hex");
        rememberOauthState(state);
        redirect(res, authorizeUrl(req, state));
        return;
    }

    if (url.pathname === "/logout") {
        const cookies = parseCookies(req.headers.cookie);
        destroySession(cookies.bh);
        redirect(res, "/", { "Set-Cookie": clearCookieHeader() });
        return;
    }

    if (url.pathname === "/oauth/callback") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const created = oauthStates.get(state);
        oauthStates.delete(state);

        if (!code || !created || Date.now() - created > STATE_TTL) {
            send(res, 400, errorPage({ user, message: "Сессия входа истекла. Попробуй ещё раз." }));
            return;
        }

        try {
            const token = await exchangeCode(req, code);
            const me = await discordGet(token.access_token, "/users/@me");
            const guilds = await discordGet(token.access_token, "/users/@me/guilds");
            const id = createSession({
                user: me,
                guilds: Array.isArray(guilds) ? guilds : [],
                token: token.access_token
            });
            redirect(res, "/servers", { "Set-Cookie": cookieHeader(id) });
        } catch (error) {
            console.error(error);
            send(res, 500, errorPage({ user, message: "Discord не пустил. Проверь CLIENT_SECRET и PUBLIC_URL." }));
        }
        return;
    }

    if (url.pathname === "/servers") {
        if (!user) {
            redirect(res, "/login");
            return;
        }
        send(res, 200, serversPage({
            user,
            guilds: withBotFlag(client, managedGuilds(session))
        }));
        return;
    }

    const serverMatch = url.pathname.match(/^\/servers\/(\d{17,20})$/);
    if (serverMatch) {
        if (!user) {
            redirect(res, "/login");
            return;
        }

        const guildId = serverMatch[1];
        const listed = findManaged(session, guildId);
        if (!listed) {
            send(res, 403, errorPage({ user, message: "Нет прав на этот сервер." }));
            return;
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            send(res, 200, errorPage({
                user,
                message: "Бота ещё нет на этом сервере. Добавь его, потом открой настройки.",
                action: `<p><a class="btn" href="${escapeHtml(inviteUrl(guildId))}">Добавить бота</a></p>`
            }));
            return;
        }

        if (req.method === "POST") {
            try {
                const raw = await readBody(req);
                const form = parseForm(raw);
                await economy.saveGuildSettings(guildId, {
                    prefix: form.prefix === "1",
                    prefixText: form.prefixText,
                    welcomeOn: form.welcomeOn === "1",
                    welcomeChannel: form.welcomeChannel,
                    welcomeMessage: form.welcomeMessage,
                    leaveMessage: form.leaveMessage
                });
                redirect(res, `/servers/${guildId}?saved=1`);
            } catch (error) {
                console.error(error);
                send(res, 500, errorPage({ user, message: "Не удалось сохранить." }));
            }
            return;
        }

        const settings = await economy.getGuildSettings(guildId);
        send(res, 200, settingsPage({
            user,
            guild: { id: guild.id, name: guild.name },
            settings,
            channels: textChannels(guild),
            saved: url.searchParams.get("saved") === "1"
        }));
        return;
    }

    if (url.pathname === "/invite") {
        redirect(res, inviteUrl());
        return;
    }

    send(res, 404, errorPage({ user, message: "Страница не найдена." }));
}

module.exports = {
    handleRequest
};
