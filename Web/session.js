const crypto = require("crypto");
const economy = require("../Database/Economy");

const DAY = 24 * 60 * 60 * 1000;
const TTL = 30 * DAY;
const memory = new Map();

function parseCookies(header) {
    const cookies = {};
    for (const part of String(header || "").split(";")) {
        const eq = part.indexOf("=");
        if (eq === -1) {
            continue;
        }
        cookies[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
    }
    return cookies;
}

function alive(session) {
    if (!session) {
        return false;
    }
    const stamp = session.lastSeen || session.createdAt || 0;
    return Date.now() - stamp <= TTL;
}

async function createSession(data) {
    const id = crypto.randomBytes(24).toString("hex");
    const now = Date.now();
    const session = {
        id,
        user: data.user,
        guilds: data.guilds || [],
        token: data.token || data.access_token || "",
        refresh_token: data.refresh_token || "",
        expires_at: Number(data.expires_at) || 0,
        createdAt: now,
        lastSeen: now
    };
    memory.set(id, session);
    await economy.saveWebSession(id, session).catch(error => {
        console.error("session save:", error);
    });
    return id;
}

async function getSession(id) {
    if (!id) {
        return null;
    }

    let session = memory.get(id);
    if (!session) {
        session = await economy.getWebSession(id).catch(() => null);
        if (session) {
            memory.set(id, session);
        }
    }

    if (!alive(session)) {
        if (id) {
            memory.delete(id);
            await economy.deleteWebSession(id).catch(() => {});
        }
        return null;
    }

    session.lastSeen = Date.now();
    memory.set(id, session);
    return session;
}

async function updateSession(id, patch) {
    const session = await getSession(id);
    if (!session) {
        return null;
    }
    Object.assign(session, patch, { lastSeen: Date.now() });
    memory.set(id, session);
    await economy.saveWebSession(id, session).catch(error => {
        console.error("session update:", error);
    });
    return session;
}

async function destroySession(id) {
    if (!id) {
        return;
    }
    memory.delete(id);
    await economy.deleteWebSession(id).catch(() => {});
}

function forgetMemory() {
    memory.clear();
}

function cookieFlags() {
    const secure = String(process.env.PUBLIC_URL || "").startsWith("https://")
        ? "; Secure"
        : "";
    return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function cookieHeader(id) {
    return `bh=${id}; ${cookieFlags()}; Max-Age=${30 * 24 * 60 * 60}`;
}

function clearCookieHeader() {
    return `bh=; ${cookieFlags()}; Max-Age=0`;
}

async function sessionFromRequest(req) {
    const cookies = parseCookies(req.headers.cookie);
    return getSession(cookies.bh);
}

module.exports = {
    parseCookies,
    createSession,
    getSession,
    updateSession,
    destroySession,
    forgetMemory,
    cookieHeader,
    clearCookieHeader,
    sessionFromRequest,
    TTL
};
