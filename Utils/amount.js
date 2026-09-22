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

function parseAmount(raw, { min = 1, max = Infinity, available = 0 } = {}) {
    if (raw == null || String(raw).trim() === "") {
        return { ok: false, reason: "missing" };
    }

    const text = String(raw).trim().toLowerCase();

    if (isAll(text)) {
        const amount = Math.min(Math.max(0, Number(available) || 0), max);
        if (amount < min) {
            return { ok: false, reason: "empty", amount: 0, all: true };
        }

        return { ok: true, amount, all: true };
    }

    if (!/^\d+$/.test(text)) {
        return { ok: false, reason: "invalid" };
    }

    const amount = Number(text);
    if (amount < min) {
        return { ok: false, reason: "min" };
    }
    if (amount > max) {
        return { ok: false, reason: "max" };
    }

    return { ok: true, amount, all: false };
}

function amountMessage(parsed, { min, max } = {}) {
    if (parsed.reason === "missing" || parsed.reason === "invalid") {
        return "Укажи сумму или `all`.";
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
    return "Укажи сумму или `all`.";
}

module.exports = {
    isAll,
    rawAmount,
    parseAmount,
    amountMessage
};
