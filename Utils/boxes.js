const { integer } = require("./random");
const { moneyInt } = require("./limits");

const DROP_KINDS = [
    { id: "coins", label: "Монеты" },
    { id: "job_xp", label: "Свиток профессии" },
    { id: "biz_boost", label: "Буст бизнеса" },
    { id: "box", label: "Другой бокс" },
    { id: "item", label: "Предмет" },
    { id: "role", label: "Цветная роль" }
];

const BOXES = [
    {
        id: "box_wood",
        name: "Деревянный бокс",
        emoji: "📦",
        description: "Случайные монеты",
        drops: [
            { kind: "coins", weight: 90, min: 80, max: 900 },
            { kind: "coins", weight: 4, min: 1200, max: 2500, jackpot: true },
            { kind: "box", weight: 6, boxId: "box_iron", qty: 1 }
        ]
    },
    {
        id: "box_iron",
        name: "Железный бокс",
        emoji: "🧰",
        description: "Пожирнее",
        drops: [
            { kind: "coins", weight: 86, min: 600, max: 5200 },
            { kind: "coins", weight: 8, min: 7000, max: 14000, jackpot: true },
            { kind: "box", weight: 6, boxId: "box_gold", qty: 1 }
        ]
    },
    {
        id: "box_gold",
        name: "Золотой бокс",
        emoji: "🎁",
        description: "Жирный лут",
        drops: [
            { kind: "coins", weight: 88, min: 4000, max: 28000 },
            { kind: "coins", weight: 12, min: 40000, max: 90000, jackpot: true }
        ]
    }
];

const MAP = new Map(BOXES.map(item => [item.id, item]));

function getBox(id) {
    return MAP.get(String(id || "")) || null;
}

function asBox(row, drops = []) {
    return {
        id: row.id,
        name: row.name,
        emoji: row.emoji || "📦",
        description: row.description || "",
        scope: row.scope,
        drops: (drops || []).map(asDrop)
    };
}

function mergeBoxes(globalItems = [], guildItems = []) {
    const map = new Map();
    for (const box of globalItems || []) {
        if (box?.id) {
            map.set(box.id, box);
        }
    }
    for (const box of guildItems || []) {
        if (box?.id) {
            map.set(box.id, box);
        }
    }
    return [...map.values()];
}

function byQuery(query, list = BOXES) {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) {
        return null;
    }
    return list.find(item =>
        item.id === q ||
        item.id.replace(/^box_/, "") === q ||
        String(item.name || "").toLowerCase() === q
    ) || null;
}

function dropExtra(drop) {
    return {
        min: moneyInt(drop.min),
        max: moneyInt(drop.max),
        jackpot: Boolean(drop.jackpot),
        steps: moneyInt(drop.steps, 1) || 1,
        percent: moneyInt(drop.percent, 10) || 10,
        type: String(drop.type || drop.biz || "").slice(0, 32),
        boxId: String(drop.boxId || drop.itemId || "").slice(0, 32),
        itemId: String(drop.itemId || "").slice(0, 32),
        qty: Math.max(1, moneyInt(drop.qty, 1) || 1),
        hex: String(drop.hex || "").trim(),
        name: String(drop.name || "").slice(0, 64),
        economy: drop.economy === "guild" ? "guild" : "global"
    };
}

function asDrop(row) {
    const extra = typeof row.extra === "object" ? row.extra : (() => {
        try {
            return JSON.parse(row.extra || "{}") || {};
        } catch {
            return {};
        }
    })();
    return {
        id: row.id,
        kind: row.kind,
        weight: Math.max(0, moneyInt(row.weight, 1) || 1),
        ...dropExtra({ ...extra, ...row })
    };
}

function pickDrop(drops, random = Math.random) {
    const list = (drops || []).map(asDrop).filter(item => item.weight > 0 && item.kind);
    const total = list.reduce((sum, item) => sum + item.weight, 0);
    if (!total) {
        return null;
    }
    let n = random() * total;
    for (const drop of list) {
        n -= drop.weight;
        if (n <= 0) {
            return drop;
        }
    }
    return list[list.length - 1];
}

function roll(box, random = Math.random) {
    if (box?.drops?.length) {
        const drop = pickDrop(box.drops, random);
        if (!drop) {
            return { amount: 0, jackpot: false, drop: null };
        }
        if (drop.kind === "coins") {
            const min = moneyInt(drop.min);
            const max = Math.max(min, moneyInt(drop.max, min));
            return {
                amount: integer(min, max),
                jackpot: Boolean(drop.jackpot),
                drop
            };
        }
        return { amount: 0, jackpot: Boolean(drop.jackpot), drop };
    }
    if (random() < (box?.jackpot || 0)) {
        return { amount: integer(box.jackpotMin, box.jackpotMax), jackpot: true, drop: null };
    }
    return { amount: integer(box.min, box.max), jackpot: false, drop: null };
}

function formatDrop(drop, extras = {}) {
    if (!drop) {
        if (extras.amount) {
            return `монеты **+${extras.amount}**`;
        }
        return "пусто";
    }
    if (drop.kind === "coins") {
        return extras.amount != null ? `монеты **+${extras.amount}**` : "монеты";
    }
    if (drop.kind === "job_xp") {
        return extras.job ? `профессия → **${extras.job}**` : "свиток профессии";
    }
    if (drop.kind === "biz_boost") {
        return extras.biz ? `буст **${extras.biz}** +${drop.percent}%` : `буст бизнеса +${drop.percent}%`;
    }
    if (drop.kind === "box") {
        return `бокс **${drop.boxId}**`;
    }
    if (drop.kind === "item") {
        return `предмет **${drop.itemId}** ×${drop.qty}`;
    }
    if (drop.kind === "role") {
        return `роль **${drop.name || drop.hex}**`;
    }
    return drop.kind;
}

module.exports = {
    BOXES,
    DROP_KINDS,
    getBox,
    asBox,
    mergeBoxes,
    byQuery,
    dropExtra,
    asDrop,
    pickDrop,
    roll,
    formatDrop
};
