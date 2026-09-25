const cache = new Map();

function put(settings) {
    if (!settings?.id) {
        return;
    }
    const { parseWords } = require("./automod");
    cache.set(String(settings.id), {
        ...settings,
        automodWordList: parseWords(settings.automodWords)
    });
}

function get(guildId) {
    if (!guildId) {
        return null;
    }
    return cache.get(String(guildId)) || null;
}

function warm(list) {
    cache.clear();
    for (const item of list || []) {
        put(item);
    }
}

function forget(guildId) {
    cache.delete(String(guildId));
}

function clear() {
    cache.clear();
}

function size() {
    return cache.size;
}

module.exports = {
    put,
    get,
    warm,
    forget,
    clear,
    size
};
