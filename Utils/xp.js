const last = new Map();
const WINDOW = 60 * 1000;

function canGainXp(guildId, userId) {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    if ((last.get(key) || 0) + WINDOW > now) {
        return false;
    }
    last.set(key, now);

    if (last.size > 20000) {
        for (const [entry, time] of last) {
            if (now - time > WINDOW * 2) {
                last.delete(entry);
            }
        }
    }

    return true;
}

function xpGain() {
    return 15 + Math.floor(Math.random() * 11);
}

module.exports = {
    canGainXp,
    xpGain
};
