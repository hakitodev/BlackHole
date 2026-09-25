const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { CLIENT_ID, CLIENT_SECRET } = require("../Config");
const economy = require("../Database/Economy");
const { canManageGuild, parseForm, escapeHtml, assertGuildManage } = require("./access");
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
    usersPage,
    adminShopPage,
    adminCatalogPage,
    adminBoxesPage,
    errorPage
} = require("./html");
const { asList } = require("../Utils/ids");
const { isBotAdmin, isOwner, guildAccess } = require("../Utils/staff");
const { eventType } = require("../Utils/events");
const { COMMANDS, canonicalName, RANGES } = require("../Utils/commands");
const { enrichUsers, lookupDiscord } = require("../Utils/profile");
const { syncGuildCustoms } = require("../Utils/syncCommands");

const STYLE = fs.readFileSync(path.join(__dirname, "style.css"), "utf8");
const EDITOR = fs.readFileSync(path.join(__dirname, "editor.js"), "utf8");
const oauthStates = new Map();
const STATE_TTL = 10 * 60 * 1000;
const CMD_IDS = new Set(COMMANDS.map(item => item.id));

function wantsGzip(req) {
    return String(req?.headers?.["accept-encoding"] || "").toLowerCase().includes("gzip");
}

function sendRaw(res, status, body, headers = {}) {
    const raw = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ""), "utf8");
    const out = { ...headers };
    if (res.req && wantsGzip(res.req) && raw.length > 256 && !out["Content-Encoding"]) {
        const compressed = zlib.gzipSync(raw);
        out["Content-Encoding"] = "gzip";
        out.Vary = out.Vary ? `${out.Vary}, Accept-Encoding` : "Accept-Encoding";
        res.writeHead(status, out);
        res.end(compressed);
        return;
    }
    res.writeHead(status, out);
    res.end(raw);
}

function send(res, status, body, headers = {}) {
    sendRaw(res, status, body, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        ...headers
    });
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
            if (size > 524288) {
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

function mergeGuildCards(list) {
    const map = new Map();
    for (const guild of list) {
        map.set(guild.id, guild);
    }
    return [...map.values()];
}

async function panelGuilds(session, client, user, admin) {
    const listed = withBotFlag(client, managedGuilds(session));
    const extra = [];
    if (user) {
        const rows = await economy.listGuildStaffForUser(user.id);
        for (const row of rows) {
            const guild = client.guilds?.cache?.get(row.guild_id);
            if (guild) {
                extra.push({
                    id: guild.id,
                    name: guild.name,
                    icon: guild.icon,
                    owner: false,
                    permissions: "0",
                    bot: true
                });
            }
        }
    }
    if (admin && client.guilds?.cache) {
        for (const guild of client.guilds.cache.values()) {
            extra.push({
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                owner: false,
                permissions: "8",
                bot: true
            });
        }
    }
    return mergeGuildCards([...listed, ...extra]);
}

async function canOpenGuild(session, guildId, client, user, admin) {
    if (findManaged(session, guildId)) {
        return true;
    }
    if (admin && client.guilds?.cache?.has(guildId)) {
        return true;
    }
    if (user) {
        const rank = await economy.getGuildStaffRank(guildId, user.id);
        if (rank >= 1) {
            return true;
        }
    }
    return false;
}

function withBotFlag(client, guilds) {
    const present = client.guilds?.cache ?? new Map();
    return guilds.map(guild => ({
        ...guild,
        bot: present.has(guild.id)
    }));
}

function botInfo(client) {
    const user = client?.user;
    if (!user) {
        return { name: "BlackHole", avatar: "" };
    }
    let avatar = "";
    try {
        avatar = typeof user.displayAvatarURL === "function"
            ? user.displayAvatarURL({ size: 64 })
            : "";
    } catch {
        avatar = "";
    }
    return {
        name: user.globalName || user.username || "BlackHole",
        avatar
    };
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
            if (me?.roles?.highest && me.roles.highest.comparePositionTo(role) <= 0) {
                return false;
            }
            return true;
        })
        .sort((a, b) => (b.rawPosition ?? 0) - (a.rawPosition ?? 0))
        .map(role => ({ id: role.id, name: role.name }));
}

function optionalChecked(form, key) {
    if (form[key] === undefined) {
        return undefined;
    }
    return checked(form, key);
}

function patchFromForm(module, form) {
    if (module === "autorole") {
        return { autoroles: asList(form.autorole) };
    }
    if (module === "automod") {
        return {
            automodLinks: checked(form, "automodLinks"),
            automodSpam: checked(form, "automodSpam"),
            automodSwear: checked(form, "automodSwear"),
            automodCaps: checked(form, "automodCaps"),
            automodWords: form.automodWords,
            automodFineLinks: form.automodFineLinks,
            automodFineSpam: form.automodFineSpam,
            automodFineSwear: form.automodFineSwear,
            automodFineCaps: form.automodFineCaps
        };
    }
    return {
        prefix: optionalChecked(form, "prefix"),
        prefixText: form.prefixText,
        xpOn: optionalChecked(form, "xpOn"),
        levelMoney: form.levelMoney,
        walletScope: form.walletScope === undefined
            ? undefined
            : (form.walletScope === "guild" ? "guild" : "global"),
        jobsGlobal: optionalChecked(form, "jobsGlobal"),
        jobsGuild: optionalChecked(form, "jobsGuild"),
        bizGlobal: optionalChecked(form, "bizGlobal"),
        bizGuild: optionalChecked(form, "bizGuild"),
        shopGlobal: optionalChecked(form, "shopGlobal"),
        shopGuild: optionalChecked(form, "shopGuild"),
        earnOn: optionalChecked(form, "earnOn"),
        economyOn: optionalChecked(form, "economyOn"),
        penaltiesOn: optionalChecked(form, "penaltiesOn"),
        paused: optionalChecked(form, "paused")
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

function customFromForm(form) {
    return {
        response: form.response,
        title: form.title,
        color: form.colorHex || form.color,
        image: form.image,
        thumbnail: form.thumbnail,
        footer: form.footer,
        content: form.content,
        author: form.author,
        authorIcon: form.authorIcon,
        url: form.url,
        footerIcon: form.footerIcon,
        fields: form.fields,
        timestamp: checked(form, "timestamp")
    };
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

async function handleAdminUsers(req, res, url, user, admin, bot, cookies, client) {
    if (req.method === "POST") {
        try {
            const form = parseForm(await readBody(req));
            const id = String(form.id || "").replace(/\D/g, "");
            if (!id) {
                send(res, 400, usersPage({
                    user,
                    admin,
                    bot,
                    users: await economy.searchUsers(""),
                    error: "Нужен Discord ID."
                }), cookies);
                return;
            }
            if (form.op === "delete") {
                await economy.deleteUser(id);
                redirect(res, "/admin/users?saved=1", cookies);
                return;
            }
            if (form.op === "reset") {
                await economy.resetCooldowns(id);
                redirect(res, `/admin/users?q=${encodeURIComponent(id)}&saved=1`, cookies);
                return;
            }
            if (form.op === "inv") {
                await economy.setInventoryItem(id, form.item, form.qty);
                redirect(res, `/admin/users?q=${encodeURIComponent(id)}&saved=1`, cookies);
                return;
            }
            await economy.setUser(id, {
                balance: form.balance,
                bank: form.bank,
                xp: form.xp,
                level: form.level,
                btc: form.btc
            });
            if (form.job !== undefined) {
                await economy.setJob(id, form.job);
            }
            redirect(res, `/admin/users?q=${encodeURIComponent(id)}&saved=1`, cookies);
        } catch (error) {
            console.error(error);
            send(res, 500, errorPage({ user, admin, bot, message: "Не удалось сохранить." }), cookies);
        }
        return;
    }

    const query = url.searchParams.get("q") || "";
    const digits = query.replace(/\D/g, "");
    if (digits.length >= 17 && client) {
        await lookupDiscord(client, digits);
    }
    const users = await enrichUsers(client, await economy.searchUsers(query));
    let current = null;
    if (query) {
        if (digits.length >= 17) {
            current = await economy.getUser(digits);
        } else {
            current = users[0] ? await economy.getUser(users[0].id) : null;
        }
    }
    send(res, 200, usersPage({
        user,
        admin,
        bot,
        query,
        users,
        current: query ? current : null,
        inventory: query && current ? await economy.getInventory(current.id) : [],
        saved: url.searchParams.get("saved") === "1"
    }), cookies);
}

async function handleBoxForm(scope, form) {
    if (form.op === "delete") {
        await economy.deleteBox(scope, form.id);
        return;
    }
    if (form.op === "delete_drop") {
        await economy.deleteDrop(scope, form.dropId);
        return;
    }
    if (form.op === "save_drop") {
        await economy.saveDrop(scope, form.boxId, form);
        return;
    }
    await economy.saveBox(scope, form);
}

async function handleRequest(req, res, client) {
    if (!res.req) {
        res.req = req;
    }
    const pathOnly = String(req.url || "").split("?")[0];
    if (req.method === "GET" && pathOnly === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
    }

    const url = new URL(req.url, "http://localhost");
    let session = await sessionFromRequest(req);
    if (session) {
        session = await refreshSession(session);
    }
    const user = session?.user ?? null;
    const admin = user ? await isBotAdmin(user.id, client) : false;
    const cookies = sessionCookie(session);
    const bot = botInfo(client);

    if (url.pathname === "/style.css") {
        sendRaw(res, 200, STYLE, { "Content-Type": "text/css; charset=utf-8" });
        return;
    }

    if (url.pathname === "/editor.js") {
        sendRaw(res, 200, EDITOR, { "Content-Type": "text/javascript; charset=utf-8" });
        return;
    }

    if (url.pathname === "/") {
        send(res, 200, homePage({ user, admin, bot, configured: Boolean(CLIENT_ID && CLIENT_SECRET) }), cookies);
        return;
    }

    if (url.pathname === "/login") {
        if (!CLIENT_ID || !CLIENT_SECRET) {
            send(res, 500, errorPage({ user, admin, bot, message: "Задай CLIENT_ID, CLIENT_SECRET и PUBLIC_URL." }));
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
            send(res, 400, errorPage({ user, admin, bot, message: "Сессия входа истекла. Попробуй ещё раз." }));
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
            send(res, 500, errorPage({ user, admin, bot, message: "Discord не пустил. Проверь CLIENT_SECRET и PUBLIC_URL." }));
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
            bot,
            guilds: await panelGuilds(session, client, user, admin)
        }), cookies);
        return;
    }

    if (url.pathname === "/admin/economy") {
        redirect(res, "/admin/users" + url.search, cookies);
        return;
    }

    if (url.pathname === "/admin/users" || url.pathname === "/admin/shop"
        || url.pathname === "/admin/jobs" || url.pathname === "/admin/biz"
        || url.pathname === "/admin/boxes") {
        if (!user) {
            redirect(res, "/login");
            return;
        }
        if (!admin) {
            send(res, 403, errorPage({ user, admin, bot, message: "Только владелец и высшие модераторы." }), cookies);
            return;
        }

        if (url.pathname === "/admin/users") {
            await handleAdminUsers(req, res, url, user, admin, bot, cookies, client);
            return;
        }

        if (url.pathname === "/admin/shop") {
            if (req.method === "POST") {
                try {
                    const form = parseForm(await readBody(req));
                    if (form.op === "delete") {
                        await economy.deleteShopItem("global", form.id);
                    } else {
                        const saved = await economy.saveShopItem("global", form);
                        if (!saved.ok) {
                            send(res, 200, adminShopPage({
                                user,
                                admin,
                                bot,
                                items: await economy.listShopItems("global"),
                                error: saved.reason === "hex" ? "HEX роли: #RRGGBB." : "Не сохранилось."
                            }), cookies);
                            return;
                        }
                    }
                    redirect(res, "/admin/shop?saved=1", cookies);
                } catch (error) {
                    console.error(error);
                    send(res, 500, errorPage({ user, admin, bot, message: "Не удалось сохранить шоп." }), cookies);
                }
                return;
            }

            send(res, 200, adminShopPage({
                user,
                admin,
                bot,
                items: await economy.listShopItems("global"),
                saved: url.searchParams.get("saved") === "1"
            }), cookies);
            return;
        }

        if (url.pathname === "/admin/jobs" || url.pathname === "/admin/biz") {
            const kind = url.pathname === "/admin/jobs" ? "job" : "biz";
            const pathName = url.pathname;
            if (req.method === "POST") {
                try {
                    const form = parseForm(await readBody(req));
                    if (form.op === "delete") {
                        await economy.deleteCatalogItem("global", kind, form.id);
                    } else {
                        await economy.saveCatalogItem("global", kind, form);
                    }
                    redirect(res, `${pathName}?saved=1`, cookies);
                } catch (error) {
                    console.error(error);
                    send(res, 500, errorPage({ user, admin, bot, message: "Не удалось сохранить каталог." }), cookies);
                }
                return;
            }
            send(res, 200, adminCatalogPage({
                user,
                admin,
                bot,
                kind,
                items: await economy.listCatalog("global", kind),
                saved: url.searchParams.get("saved") === "1"
            }), cookies);
            return;
        }

        if (req.method === "POST") {
            try {
                await handleBoxForm("global", parseForm(await readBody(req)));
                redirect(res, "/admin/boxes?saved=1", cookies);
            } catch (error) {
                console.error(error);
                send(res, 500, errorPage({ user, admin, bot, message: "Не удалось сохранить боксы." }), cookies);
            }
            return;
        }

        send(res, 200, adminBoxesPage({
            user,
            admin,
            bot,
            boxes: await economy.listBoxes("global"),
            saved: url.searchParams.get("saved") === "1"
        }), cookies);
        return;
    }

    const serverMatch = url.pathname.match(/^\/servers\/(\d{17,20})(?:\/(.*))?$/);
    if (serverMatch) {
        if (!user) {
            redirect(res, "/login");
            return;
        }

        const guildId = serverMatch[1];
        const rest = String(serverMatch[2] || "");
        const listed = await canOpenGuild(session, guildId, client, user, admin);
        if (!listed) {
            send(res, 403, errorPage({ user, admin, bot, message: "Нет прав на этот сервер." }), cookies);
            return;
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            send(res, 200, errorPage({
                user,
                admin,
                bot,
                message: "Бота ещё нет на этом сервере. Добавь его, потом открой настройки.",
                action: `<p><a class="btn" href="${escapeHtml(inviteUrl(guildId))}">Добавить бота</a></p>`
            }), cookies);
            return;
        }

        if (!rest && req.method === "GET") {
            redirect(res, `/servers/${guildId}/general`, cookies);
            return;
        }

        const cmdMatch = rest.match(/^cmd\/([a-z0-9_-]+)$/i);
        const customMatch = rest.match(/^custom(?:\/([a-z0-9_-]+))?$/i);
        const commandsAlias = rest === "commands";
        const module = cmdMatch ? "cmd" : (customMatch || commandsAlias) ? "custom" : rest;
        const cmdName = cmdMatch ? canonicalName(cmdMatch[1]) : "";
        const customName = customMatch ? (customMatch[1] || "") : (url.searchParams.get("edit") || "");

        if (module === "cmd" && !CMD_IDS.has(cmdName)) {
            send(res, 404, errorPage({ user, admin, bot, message: "Страница не найдена." }), cookies);
            return;
        }

        if (module !== "cmd" && module !== "custom" && !eventType(module)
            && !["general", "autorole", "automod", "shop", "jobs", "biz", "boxes"].includes(module)) {
            send(res, 404, errorPage({ user, admin, bot, message: "Страница не найдена." }), cookies);
            return;
        }

        const custom = await economy.listCustomCommands(guildId);

        if (req.method === "POST") {
            const access = await guildAccess(user.id, guild, client);
            const allowed = access.global || access.local || await assertGuildManage(guild, user.id);
            if (!allowed) {
                send(res, 403, errorPage({ user, admin, bot, message: "Нет прав на этот сервер." }), cookies);
                return;
            }
            try {
                const form = parseForm(await readBody(req));
                if (module === "custom") {
                    const name = form.name || customName;
                    if (form.op === "delete") {
                        await economy.deleteCustomCommand(guildId, name);
                        if (client.commands) {
                            await syncGuildCustoms(guild, new Set(client.commands.keys()));
                        }
                        redirect(res, `/servers/${guildId}/custom?saved=1`, cookies);
                        return;
                    }
                    const saved = await economy.saveCustomCommand(guildId, name, customFromForm(form));
                    if (client.commands) {
                        await syncGuildCustoms(guild, new Set(client.commands.keys()));
                    }
                    redirect(res, `/servers/${guildId}/custom/${saved.name || name}?saved=1`, cookies);
                    return;
                }
                if (module === "cmd") {
                    const settings = await economy.getGuildSettings(guildId);
                    const disabled = new Set(settings.disabledCommands);
                    if (checked(form, "enabled")) {
                        disabled.delete(cmdName);
                    } else {
                        disabled.add(cmdName);
                    }
                    const patch = { disabledCommands: [...disabled] };
                    const fields = RANGES[cmdName] || [];
                    for (const field of fields) {
                        if (form[field.key] !== undefined) {
                            patch[field.key] = form[field.key];
                        }
                    }
                    await economy.saveGuildSettings(guildId, patch);
                    redirect(res, `/servers/${guildId}/cmd/${cmdName}?saved=1`, cookies);
                    return;
                }
                if (module === "shop") {
                    if (form.op === "delete") {
                        await economy.deleteShopItem(guildId, form.id);
                    } else {
                        const saved = await economy.saveShopItem(guildId, form);
                        if (!saved.ok) {
                            send(res, 200, errorPage({
                                user,
                                admin,
                                bot,
                                guild: { id: guild.id, name: guild.name },
                                message: saved.reason === "hex" ? "HEX роли: строго #RRGGBB." : "Не сохранилось."
                            }), cookies);
                            return;
                        }
                    }
                    redirect(res, `/servers/${guildId}/shop?saved=1`, cookies);
                    return;
                }
                if (module === "boxes") {
                    await handleBoxForm(guildId, form);
                    redirect(res, `/servers/${guildId}/boxes?saved=1`, cookies);
                    return;
                }
                if (module === "jobs" || module === "biz") {
                    const kind = module === "jobs" ? "job" : "biz";
                    if (form.op === "delete") {
                        await economy.deleteCatalogItem(guildId, kind, form.id);
                    } else {
                        await economy.saveCatalogItem(guildId, kind, form);
                    }
                    redirect(res, `/servers/${guildId}/${module}?saved=1`, cookies);
                    return;
                }
                if (eventType(module)) {
                    await economy.saveGuildEvent(guildId, module, {
                        enabled: checked(form, "enabled"),
                        channel: form.channel,
                        message: form.message
                    });
                    redirect(res, `/servers/${guildId}/${module}?saved=1`, cookies);
                    return;
                }
                const patch = patchFromForm(module, form);
                if (!isOwner({ client, user })) {
                    delete patch.paused;
                }
                await economy.saveGuildSettings(guildId, patch);
                redirect(res, `/servers/${guildId}/${module}?saved=1`, cookies);
            } catch (error) {
                console.error(error);
                send(res, 500, errorPage({ user, admin, bot, message: "Не удалось сохранить." }), cookies);
            }
            return;
        }

        const settings = await economy.getGuildSettings(guildId);
        send(res, 200, settingsPage({
            user,
            admin,
            bot,
            guild: { id: guild.id, name: guild.name },
            settings,
            channels: textChannels(guild),
            roles: assignableRoles(guild),
            custom,
            event: eventType(module) ? await economy.getGuildEvent(guildId, module) : undefined,
            shop: module === "shop" ? await economy.listShopItems(guildId) : [],
            jobs: module === "jobs" ? await economy.listCatalog(guildId, "job") : [],
            businesses: module === "biz" ? await economy.listCatalog(guildId, "biz") : [],
            boxes: module === "boxes" ? await economy.listBoxes(guildId) : [],
            owner: isOwner({ client, user }),
            editCommand: module === "custom" && customName
                ? await economy.getCustomCommand(guildId, customName)
                : null,
            module,
            cmdName,
            customName,
            saved: url.searchParams.get("saved") === "1"
        }), cookies);
        return;
    }

    if (url.pathname === "/invite") {
        redirect(res, inviteUrl());
        return;
    }

    send(res, 404, errorPage({ user, admin, bot, message: "Страница не найдена." }), cookies);
}

module.exports = {
    handleRequest
};
