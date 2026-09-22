const { integer } = require("./random");

const BOXES = [
    { id: "box_wood", name: "Деревянный бокс", emoji: "📦", min: 80, max: 900, jackpot: 0.04, jackpotMin: 1200, jackpotMax: 2500 },
    { id: "box_iron", name: "Железный бокс", emoji: "🧰", min: 600, max: 5200, jackpot: 0.08, jackpotMin: 7000, jackpotMax: 14000 },
    { id: "box_gold", name: "Золотой бокс", emoji: "🎁", min: 4000, max: 28000, jackpot: 0.12, jackpotMin: 40000, jackpotMax: 90000 }
];

const MAP = new Map(BOXES.map(item => [item.id, item]));

function getBox(id) {
    return MAP.get(String(id || "")) || null;
}

function byQuery(query) {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) {
        return null;
    }
    return BOXES.find(item =>
        item.id === q ||
        item.id.replace(/^box_/, "") === q ||
        item.name.toLowerCase() === q
    ) || null;
}

function roll(box, random = Math.random) {
    if (random() < box.jackpot) {
        return { amount: integer(box.jackpotMin, box.jackpotMax), jackpot: true };
    }
    return { amount: integer(box.min, box.max), jackpot: false };
}

module.exports = {
    BOXES,
    getBox,
    byQuery,
    roll
};
