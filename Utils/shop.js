const economy = require("../Database/Economy");

async function list(guildId) {
    return economy.listShop(guildId);
}

async function get(id, guildId) {
    return (await economy.getShopItem(guildId, id)) || (await economy.findShopItem(id));
}

async function find(guildId, query) {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) {
        return null;
    }

    const direct = await economy.getShopItem(guildId, q);
    if (direct) {
        return direct;
    }

    const items = await economy.listShop(guildId);
    return items.find(item =>
        item.name.toLowerCase() === q ||
        item.id.toLowerCase() === q
    ) ?? await economy.findShopItem(q);
}

function format(item) {
    if (!item) {
        return "";
    }
    return `${item.emoji ? `${item.emoji} ` : ""}${item.name}`.trim();
}

module.exports = {
    list,
    get,
    find,
    format
};
