function isHexColor(value) {
    return /^#[0-9A-F]{6}$/i.test(String(value ?? "").trim());
}

function parseColor(value, fallback = 0x5865F2) {
    const raw = String(value ?? "").trim();
    if (!raw) {
        return fallback;
    }

    if (isHexColor(raw)) {
        return parseInt(raw.slice(1), 16);
    }

    const hex = raw.startsWith("#") ? raw.slice(1) : raw;
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
        return parseInt(hex, 16);
    }

    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0 && n <= 0xFFFFFF) {
        return n;
    }

    return fallback;
}

function toHex(value, fallback = "#5865F2") {
    const parsed = parseColor(value, null);
    if (parsed === null) {
        return fallback;
    }
    return `#${parsed.toString(16).padStart(6, "0")}`;
}

function isUrl(value) {
    try {
        const url = new URL(String(value || ""));
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

module.exports = {
    isHexColor,
    parseColor,
    toHex,
    isUrl
};
