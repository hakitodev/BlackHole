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
    parseCookies,
    updateSession
} = require("./session");
const { authorizeUrl, exchangeCode, discordGet, inviteUrl, refreshAccess } = require("./oauth");
const {
    homePage,
    serversPage,
    settingsPage,
    economyPage,
    adminShopPage,
    errorPage,
    MODULES
} = require("./html");
const { asList } = require("../Utils/ids");
const { DANGEROUS_PERMISSIONS } = require("../Utils/roles");
const { isBotAdmin } = require("../Utils/staff");
const { eventType } = require("../Utils/events");

const STYLE = fs.readFileSync(path.join(__dirname, "style.css"), "utf8");
const oauthStates = new Map();
const STATE_TTL = 10 * 60 * 1000;
const MODULE_IDS = new Set(MODULES.filter(item => item.id).map(item => item.id));

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

function checked(form, key) {
    const value = form[key];
    if (Array.isArray(value)) {
        return value.includes("1");
    }
    return value === "1";
}

function assignableRoles(guild) {
    const me = guild.members?.me;
    return [...(guild.roles?.cache?.values() ?? [])]
        .filter(role => {
            if (!role || role.id === guild.id || role.managed) {
                return false;
            }
            if (DANGEROUS_PERMISSIONS.some(permission => role.permissions?.has?.(permission))) {
                return false;
            }
            if (me?.roles?.highest && me.roles.highest.comparePositionTo(role) <= 0) {
                return false;
            }
            return true;
        })
        .sort((a, b) => (b.rawPosition ?? 0) - (a.rawPosition ?? 0))
        .slice(0, 40)
        .map(role => ({ id: role.id, name: role.name }));
}

function patchFromForm(module, form) {
    if (module === "autorole") {
        return { autoroles: asList(form.autorole) };
    }
    if (module === "automod") {
        return {
            automodInvites: checked(form, "automodInvites"),
            automodWords: form.automodWords
        };
    }
    if (module === "limits") {
        return {
            disabledCommands: asList(form.disabled),
            flipMin: form.flipMin,
            flipMax: form.flipMax,
            payMin: form.payMin,
            payMax: form.payMax,
            robMin: form.robMin,
            buyMax: form.buyMax
        };
    }
    return {
        prefix: checked(form, "prefix"),
        prefixText: form.prefixText
    };
}

function textChannels(guild) {
    return [...guild.channels.cache.values()]
        .filter(channel => channel.isTextBased?.() && !channel.isThread?.() && !channel.isVoiceBased?.())
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map(channel => ({ id: channel.id, name: channel.name }));
}

function sessionCookie(session) {
    return session?.id ? { "Set-Cookie": cookieHeader(session.id) } : {};
}

async function refreshSession(session) {
    if (!session?.refresh_token) {
        return session;
    }
    if (session.expires_at && session.expires_at > Date.now() + 60 * 1000) {
        return session;
    }

    try {
        const token = await refreshAccess(session.refresh_token);
        const me = await discordGet(token.access_token, "/users/@me");
        const guilds = await discordGet(token.access_token, "/users/@me/guilds");
        return updateSession(session.id, {
            user: me,
            guilds: Array.isArray(guilds) ? guilds : session.guilds,
            token: token.access_token,
            refresh_token: token.refresh_token || session.refresh_token,
            expires_at: Date.now() + (Number(token.expires_in) || 604800) * 1000 - 60 * 1000
        });
    } catch (error) {
        console.error("session refresh:", error);
        if (String(error.message).includes("invalid_grant")) {
            await destroySession(session.id);
            return null;
        }
        return session;
    }
}

async function handleRequest(req, res, client) {
    const url = new URL(req.url, "http://localhost");
    let session = await sessionFromRequest(req);
    if (session) {
        session = await refreshSession(session);
    }
    const user = session?.user ?? null;
    const admin = user ? await isBotAdmin(user.id, client) : false;
    const cookies = sessionCookie(session);

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
        send(res, 200, homePage({ user, admin, configured: Boolean(CLIENT_ID && CLIENT_SECRET) }), cookies);
        return;
    }

    if (url.pathname === "/login") {
        if (!CLIENT_ID || !CLIENT_SECRET) {
            send(res, 500, errorPage({ user, admin, message: "Задай CLIENT_ID, CLIENT_SECRET и PUBLIC_URL." }));
            return;
        }
        const state = crypto.randomBytes(16).toString("hex");
        rememberOauthState(state);
        redirect(res, authorizeUrl(req, state));
        return;
    }

    if (url.pathname === "/logout") {
        const raw = parseCookies(req.headers.cookie);
        await destroySession(raw.bh);
        redirect(res, "/", { "Set-Cookie": clearCookieHeader() });
        return;
    }

    if (url.pathname === "/oauth/callback") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const created = oauthStates.get(state);
        oauthStates.delete(state);

        if (!code || !created || Date.now() - created > STATE_TTL) {
            send(res, 400, errorPage({ user, admin, message: "Сессия входа истекла. Попробуй ещё раз." }));
            return;
        }

        try {
            const token = await exchangeCode(req, code);
            const me = await discordGet(token.access_token, "/users/@me");
            const guilds = await discordGet(token.access_token, "/users/@me/guilds");
            const id = await createSession({
                user: me,
                guilds: Array.isArray(guilds) ? guilds : [],
                token: token.access_token,
                refresh_token: token.refresh_token || "",
                expires_at: Date.now() + (Number(token.expires_in) || 604800) * 1000 - 60 * 1000
            });
            redirect(res, "/servers", { "Set-Cookie": cookieHeader(id) });
        } catch (error) {
            console.error(error);
            send(res, 500, errorPage({ user, admin, message: "Discord не пустил. Проверь CLIENT_SECRET и PUBLIC_URL." }));
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
            admin,
            guilds: withBotFlag(client, managedGuilds(session))
        }), cookies);
        return;
    }

    if (url.pathname === "/admin/economy" || url.pathname === "/admin/shop") {
        if (!user) {
            redirect(res, "/login");
            return;
        }
        if (!admin) {
            send(res, 403, errorPage({ user, admin, message: "Только владелец и высшие модераторы." }), cookies);
            return;
        }

        if (url.pathname === "/admin/economy") {
            if (req.method === "POST") {
                try {
                    const form = parseForm(await readBody(req));
                    const id = String(form.id || "").replace(/\D/g, "");
                    if (!id) {
                        send(res, 400, economyPage({
                            user,
                            admin,
                            users: await economy.searchUsers(""),
                            error: "Нужен Discord ID."
                        }), cookies);
                        return;
                    }
                    await economy.setWallet(id, {
                        balance: form.balance,
                        bank: form.bank
                    });
                    redirect(res, `/admin/economy?q=${encodeURIComponent(id)}&saved=1`, cookies);
                } catch (error) {
                    console.error(error);
                    send(res, 500, errorPage({ user, admin, message: "Не удалось сохранить." }), cookies);
                }
                return;
            }

            const query = url.searchParams.get("q") || "";
            send(res, 200, economyPage({
                user,
                admin,
                query,
                users: await economy.searchUsers(query),
                saved: url.searchParams.get("saved") === "1"
            }), cookies);
            return;
        }

        if (req.method === "POST") {
            try {
                const form = parseForm(await readBody(req));
                if (form.op === "delete") {
                    await economy.deleteShopItem("global", form.id);
                } else {
                    await economy.saveShopItem("global", form);
                }
                redirect(res, "/admin/shop?saved=1", cookies);
            } catch (error) {
                console.error(error);
                send(res, 500, errorPage({ user, admin, message: "Не удалось сохранить шоп." }), cookies);
            }
            return;
        }

        send(res, 200, adminShopPage({
            user,
            admin,
            items: await economy.listShopItems("global"),
            saved: url.searchParams.get("saved") === "1"
        }), cookies);
        return;
    }

    const serverMatch = url.pathname.match(/^\/servers\/(\d{17,20})(?:\/([A-Za-z]+))?$/);
    if (serverMatch) {
        if (!user) {
            redirect(res, "/login");
            return;
        }

        const guildId = serverMatch[1];
        const module = serverMatch[2] || "";
        if (module && !MODULE_IDS.has(module)) {
            send(res, 404, errorPage({ user, admin, message: "Страница не найдена." }), cookies);
            return;
        }

        const listed = findManaged(session, guildId);
        if (!listed) {
            send(res, 403, errorPage({ user, admin, message: "Нет прав на этот сервер." }), cookies);
            return;
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            send(res, 200, errorPage({
                user,
                admin,
                message: "Бота ещё нет на этом сервере. Добавь его, потом открой настройки.",
                action: `<p><a class="btn" href="${escapeHtml(inviteUrl(guildId))}">Добавить бота</a></p>`
            }), cookies);
            return;
        }

        const current = module || "general";

        if (!module && req.method === "GET") {
            redirect(res, `/servers/${guildId}/general`, cookies);
            return;
        }

        if (req.method === "POST") {
            try {
                const form = parseForm(await readBody(req));
                if (current === "commands") {
                    if (form.op === "delete") {
                        await economy.deleteCustomCommand(guildId, form.name);
                    } else {
                        await economy.saveCustomCommand(guildId, form.name, {
                            response: form.response,
                            title: form.title,
                            color: form.colorHex || form.color,
                            image: form.image,
                            thumbnail: form.thumbnail,
                            footer: form.footer
                        });
                    }
                } else if (current === "shop") {
                    if (form.op === "delete") {
                        await economy.deleteShopItem(guildId, form.id);
                    } else {
                        await economy.saveShopItem(guildId, form);
                    }
                } else if (eventType(current)) {
                    await economy.saveGuildEvent(guildId, current, {
                        enabled: checked(form, "enabled"),
                        channel: form.channel,
                        message: form.message
                    });
                } else {
                    await economy.saveGuildSettings(guildId, patchFromForm(current, form));
                }
                redirect(res, `/servers/${guildId}/${current}?saved=1`, cookies);
            } catch (error) {
                console.error(error);
                send(res, 500, errorPage({ user, admin, message: "Не удалось сохранить." }), cookies);
            }
            return;
        }

        const settings = await economy.getGuildSettings(guildId);
        const editName = url.searchParams.get("edit");
        send(res, 200, settingsPage({
            user,
            admin,
            guild: { id: guild.id, name: guild.name },
            settings,
            channels: textChannels(guild),
            roles: assignableRoles(guild),
            commands: current === "commands" ? await economy.listCustomCommands(guildId) : [],
            event: eventType(current) ? await economy.getGuildEvent(guildId, current) : undefined,
            shop: current === "shop" ? await economy.listShopItems(guildId) : [],
            editCommand: current === "commands" && editName
                ? await economy.getCustomCommand(guildId, editName)
                : null,
            module: current,
            saved: url.searchParams.get("saved") === "1"
        }), cookies);
        return;
    }

    if (url.pathname === "/invite") {
        redirect(res, inviteUrl());
        return;
    }

    send(res, 404, errorPage({ user, admin, message: "Страница не найдена." }), cookies);
}

module.exports = {
    handleRequest
};
