const pending = new Map();
let timer = null;
let clientRef = null;

function keyOf(userId, scope) {
    return `${scope || "global"}:${userId}`;
}

function add(userId, xp, moneyPerLevel = 250, scope = "global", extra = {}) {
    const key = keyOf(userId, scope);
    const cur = pending.get(key) || {
        userId: String(userId),
        xp: 0,
        moneyPerLevel,
        scope: scope || "global",
        guildId: extra.guildId || "",
        channelId: extra.channelId || ""
    };
    cur.xp += Math.max(0, Math.floor(Number(xp) || 0));
    cur.moneyPerLevel = moneyPerLevel;
    if (extra.guildId) {
        cur.guildId = extra.guildId;
    }
    if (extra.channelId) {
        cur.channelId = extra.channelId;
    }
    pending.set(key, cur);
}

async function flush() {
    const entries = [...pending.values()].filter(entry => entry.xp > 0);
    pending.clear();
    if (!entries.length) {
        return [];
    }

    const economy = require("../Database/Economy");
    const results = await economy.addXpBatch(entries);
    if (!clientRef) {
        return results;
    }

    const { fireEvent } = require("./events");
    for (const result of results) {
        if (!result.progress?.leveled || !result.guildId) {
            continue;
        }
        const guild = clientRef.guilds?.cache?.get(result.guildId);
        if (!guild) {
            continue;
        }
        const user = await clientRef.users.fetch(result.userId).catch(() => null);
        if (!user) {
            continue;
        }
        const channel = result.channelId
            ? guild.channels.cache.get(result.channelId)
            : null;
        await fireEvent(guild, "levelUp", {
            user,
            level: result.progress.level,
            money: result.progress.money,
            xp: result.progress.xp
        }, channel).catch(() => {});
    }
    return results;
}

function start(client, ms = 90 * 1000) {
    clientRef = client || clientRef;
    stop();
    timer = setInterval(() => {
        flush().catch(error => console.error("xp flush:", error));
    }, ms);
    if (typeof timer.unref === "function") {
        timer.unref();
    }
}

function stop() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

function size() {
    return pending.size;
}

module.exports = {
    add,
    flush,
    start,
    stop,
    size
};
