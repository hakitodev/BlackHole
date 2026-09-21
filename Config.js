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

module.exports = {
    CLIENT_ID: process.env.CLIENT_ID || "",
    OWNER_ID: process.env.OWNER_ID || "",
    SERVERS: loadServers()
};
