const INVITE = /discord(?:\.gg|(?:app)?\.com\/invite)\/[a-z0-9-]+/i;

function parseWords(raw) {
    return String(raw ?? "")
        .split(/[\n,]+/)
        .map(word => word.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 50);
}

function hasInvite(text) {
    return INVITE.test(String(text ?? ""));
}

function normalizeText(text) {
    return String(text ?? "")
        .replace(/\s+/g, " ")
        .trim();
}

function isCapsSpam(text, minLength = 10, ratio = 0.7) {
    const source = normalizeText(text);
    if (source.length < minLength) {
        return false;
    }

    const letters = source.match(/[A-ZА-Я]/g) || [];
    if (letters.length < minLength) {
        return false;
    }

    const upperRatio = letters.length / source.replace(/\s+/g, "").length;
    return upperRatio >= ratio;
}

function isSpamLike(text, minLength = 12) {
    const source = normalizeText(text);
    if (source.length < minLength) {
        return false;
    }

    const plain = source.replace(/\s+/g, "");
    if (plain.length < minLength) {
        return false;
    }

    const repeats = /(.)\1{3,}/i.test(plain) || /(\W)\1{3,}/.test(plain);
    const flood = /(?:https?:\/\/|www\.)/i.test(source) && source.split(/\s+/).length > 8;
    return repeats || flood;
}

function findBannedWord(text, words) {
    const source = String(text ?? "").toLowerCase();
    if (!source) {
        return null;
    }

    for (const word of words) {
        if (word.length >= 2 && source.includes(word)) {
            return word;
        }
    }

    return null;
}

function detectAutomod(text, settings = {}) {
    const source = String(text ?? "");
    if (!source.trim()) {
        return null;
    }

    if (settings.automodInvites && hasInvite(source)) {
        return "инвайт";
    }

    const words = parseWords(settings.automodWords);
    const banned = findBannedWord(source, words);
    if (banned) {
        return `слово «${banned}»`;
    }

    if (settings.automodCaps && isCapsSpam(source)) {
        return "капс";
    }

    if (settings.automodSpam && isSpamLike(source)) {
        return "спам";
    }

    return null;
}

function isPrivileged(member) {
    return Boolean(
        member?.permissions?.has?.("ManageMessages")
        || member?.permissions?.has?.("ManageGuild")
        || member?.permissions?.has?.("Administrator")
    );
}

module.exports = {
    parseWords,
    hasInvite,
    isCapsSpam,
    isSpamLike,
    findBannedWord,
    detectAutomod,
    isPrivileged
};
