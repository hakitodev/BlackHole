const { SAFE_MAX, PAY_MAX } = require("./limits");

const ALL = new Set(["all", "max", "allin", "всё", "все", "макс"]);

function isAll(raw) {
    return ALL.has(String(raw ?? "").trim().toLowerCase());
}

function rawAmount(interaction) {
    const text = interaction.options.getString("amount");
    if (text != null && String(text).trim() !== "") {
        return String(text).trim();
    }

    const number = interaction.options.getInteger("amount");
    if (number != null) {
        return String(number);
    }

    return null;
}

function parseDigits(text) {
    if (!/^[0-9]+$/.test(text)) {
        return { ok: false, reason: "invalid" };
    }
    if (text.length > 16) {
        return { ok: false, reason: "overflow" };
    }
    const amount = Math.floor(Number(text));
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > SAFE_MAX) {
        return { ok: false, reason: "overflow" };
    }
    return { ok: true, amount };
}

function parseAmount(raw, { min = 1, max = PAY_MAX, available = 0 } = {}) {
    if (raw == null || String(raw).trim() === "") {
        return { ok: false, reason: "missing" };
    }

    const text = String(raw).trim().toLowerCase();
    if (/[-+e.,\s]/.test(text) && !isAll(text)) {
        return { ok: false, reason: "invalid" };
    }

    const floorMin = Math.max(1, Math.floor(Number(min) || 1));
    const floorMax = Math.min(
        SAFE_MAX,
        Math.floor(Number(max) > 0 ? Number(max) : PAY_MAX)
    );
    const floorAvail = Math.max(0, Math.floor(Number(available) || 0));

    if (isAll(text)) {
        const amount = Math.min(floorAvail, floorMax);
        if (amount < floorMin) {
            return { ok: false, reason: "empty", amount: 0, all: true };
        }
        return { ok: true, amount, all: true };
    }

    const parsed = parseDigits(text);
    if (!parsed.ok) {
        return parsed;
    }

    const amount = parsed.amount;
    if (amount < floorMin) {
        return { ok: false, reason: "min" };
    }
    if (amount > floorMax) {
        return { ok: false, reason: "max" };
    }
    if (amount > floorAvail && floorAvail >= 0 && arguments[1]?.available != null) {
        return { ok: false, reason: "insufficient" };
    }

    return { ok: true, amount, all: false };
}

function amountMessage(parsed, { min, max } = {}) {
    if (parsed.reason === "missing" || parsed.reason === "invalid") {
        return "Укажи целое число или `all`.";
    }
    if (parsed.reason === "overflow") {
        return "Слишком большое число.";
    }
    if (parsed.reason === "insufficient") {
        return "Не хватает.";
    }
    if (parsed.reason === "empty") {
        return "Нечего брать.";
    }
    if (parsed.reason === "min") {
        return min != null ? `Минимум **${min}**.` : "Слишком мало.";
    }
    if (parsed.reason === "max") {
        return max != null ? `Максимум **${max}**.` : "Слишком много.";
    }
    return "Укажи целое число или `all`.";
}

module.exports = {
    isAll,
    rawAmount,
    parseAmount,
    amountMessage
};
