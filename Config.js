require("./Utils/env");

const fs = require("fs");
const path = require("path");

function parseServers(raw, source) {
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed;
        }

        console.warn(`${source}: нужен объект { guildId: { channelId, welcomeMessage, leaveMessage } }`);
    } catch (error) {
        console.warn(`Не удалось разобрать ${source}:`, error.message);
    }

    return null;
}

function loadServers() {
    if (process.env.SERVERS_JSON) {
        const fromEnv = parseServers(process.env.SERVERS_JSON, "SERVERS_JSON");
        if (fromEnv) {
            return fromEnv;
        }
    }

    const filePath = process.env.SERVERS_FILE
        ? path.resolve(process.env.SERVERS_FILE)
        : path.join(__dirname, "servers.json");

    if (!fs.existsSync(filePath)) {
        return {};
    }

    return parseServers(fs.readFileSync(filePath, "utf8"), filePath) ?? {};
}

function resolvePublicUrl() {
    const explicit = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
    if (explicit) {
        return explicit;
    }

    const render = (process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
    if (render) {
        return render;
    }

    const railway = (process.env.RAILWAY_PUBLIC_DOMAIN || "").replace(/\/$/, "");
    if (railway) {
        return railway.startsWith("http") ? railway : `https://${railway}`;
    }

    return "";
}

module.exports = {
    CLIENT_ID: process.env.CLIENT_ID || "",
    CLIENT_SECRET: process.env.CLIENT_SECRET || "",
    OWNER_ID: process.env.OWNER_ID || "",
    PREFIX: (process.env.PREFIX ?? "!").trim() || "!",
    PUBLIC_URL: resolvePublicUrl(),
    SERVERS: loadServers()
};
