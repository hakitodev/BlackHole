const crypto = require("crypto");

const DAY = 24 * 60 * 60 * 1000;
const sessions = new Map();

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

function createSession(data) {
    const id = crypto.randomBytes(24).toString("hex");
    sessions.set(id, { ...data, createdAt: Date.now() });
    return id;
}

function getSession(id) {
    if (!id) {
        return null;
    }

    const session = sessions.get(id);
    if (!session) {
        return null;
    }

    if (Date.now() - session.createdAt > 7 * DAY) {
        sessions.delete(id);
        return null;
    }

    return session;
}

function destroySession(id) {
    sessions.delete(id);
}

function cookieFlags() {
    const secure = String(process.env.PUBLIC_URL || "").startsWith("https://")
        ? "; Secure"
        : "";
    return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function cookieHeader(id) {
    return `bh=${id}; ${cookieFlags()}; Max-Age=${7 * 24 * 60 * 60}`;
}

function clearCookieHeader() {
    return `bh=; ${cookieFlags()}; Max-Age=0`;
}

function sessionFromRequest(req) {
    const cookies = parseCookies(req.headers.cookie);
    return getSession(cookies.bh);
}

module.exports = {
    parseCookies,
    createSession,
    getSession,
    destroySession,
    cookieHeader,
    clearCookieHeader,
    sessionFromRequest
};
