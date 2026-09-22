const BUSINESSES = [
    { id: "stall", name: "Ларёк", emoji: "🛒", price: 5000, income: 8, cap: 2000, maxLevel: 10 },
    { id: "cafe", name: "Кафе", emoji: "☕", price: 25000, income: 40, cap: 8000, maxLevel: 10 },
    { id: "shop", name: "Магазин", emoji: "🏪", price: 80000, income: 120, cap: 25000, maxLevel: 10 },
    { id: "factory", name: "Завод", emoji: "🏭", price: 250000, income: 400, cap: 80000, maxLevel: 10 },
    { id: "corp", name: "Корп", emoji: "🏢", price: 1000000, income: 1500, cap: 300000, maxLevel: 10 }
];

const MAP = new Map(BUSINESSES.map(item => [item.id, item]));

function getBusiness(id) {
    return MAP.get(String(id || "")) || null;
}

function byQuery(query) {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) {
        return null;
    }
    return BUSINESSES.find(item => item.id === q || item.name.toLowerCase() === q) || null;
}

function upgradeCost(def, level) {
    return Math.floor(def.price * Math.max(1, level) * 1.6);
}

function incomePerMin(def, level) {
    return def.income * (1 + 0.25 * (Math.max(1, level) - 1));
}

function fromCatalog(row) {
    return {
        id: row.id,
        name: row.name,
        emoji: row.emoji || "🏢",
        price: Math.max(0, Number(row.price) || 0),
        income: Math.max(0, Number(row.income) || 0),
        cap: Math.max(1, Number(row.cap) || 1000),
        maxLevel: Math.max(1, Number(row.maxLevel) || 10)
    };
}

function mergeBusinesses(globalOn, guildItems = []) {
    const map = new Map();
    if (globalOn !== false) {
        for (const item of BUSINESSES) {
            map.set(item.id, item);
        }
    }
    for (const item of guildItems) {
        if (!item?.id) {
            continue;
        }
        map.set(item.id, fromCatalog(item));
    }
    return [...map.values()];
}

function getBusinessFrom(list, id) {
    return list.find(item => item.id === String(id || "")) || null;
}

function byQueryFrom(list, query) {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) {
        return null;
    }
    return list.find(item => item.id === q || item.name.toLowerCase() === q) || null;
}

module.exports = {
    BUSINESSES,
    getBusiness,
    byQuery,
    upgradeCost,
    incomePerMin,
    mergeBusinesses,
    getBusinessFrom,
    byQueryFrom
};
