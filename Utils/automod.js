const INVITE = /discord(?:\.gg|(?:app)?\.com\/invite)\/[a-z0-9-]+/i;
const LINK = /(?:https?:\/\/|www\.)\S+|discord(?:\.gg|(?:app)?\.com\/invite)\/[a-z0-9-]+/i;

const SWEARS = [
    "хуй", "хуя", "хуе", "хуи", "пизд", "ебал", "ебат", "ебан", "ёбан",
    "бля", "сука", "суки", "мудак", "мудил", "нахуй", "похуй", "залуп",
    "пидор", "пидр", "гандон", "еблан"
];

const spam = new Map();
const SPAM_WINDOW = 5000;
const SPAM_COUNT = 5;
const DUP_COUNT = 3;

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

function hasLink(text) {
    return LINK.test(String(text ?? ""));
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

function isCaps(text) {
    const letters = String(text ?? "").replace(/[^a-zA-Zа-яА-ЯёЁ]/g, "");
    if (letters.length < 8) {
        return false;
    }
    let upper = 0;
    for (const ch of letters) {
        if (ch !== ch.toLowerCase() && ch === ch.toUpperCase()) {
            upper += 1;
        }
    }
    return upper / letters.length >= 0.72;
}

function pruneSpam(now) {
    if (spam.size < 1200) {
        return;
    }
    for (const [key, row] of spam) {
        const last = row?.stamps?.[row.stamps.length - 1] || 0;
        if (now - last > 30000) {
            spam.delete(key);
        }
    }
}

function isSpam(guildId, userId, text, now = Date.now()) {
    const key = `${guildId}:${userId}`;
    let row = spam.get(key);
    if (!row) {
        row = { stamps: [], last: "", same: 0 };
        spam.set(key, row);
    }
    row.stamps = row.stamps.filter(stamp => now - stamp < SPAM_WINDOW);
    row.stamps.push(now);
    const body = String(text ?? "");
    if (body && body === row.last) {
        row.same += 1;
    } else {
        row.same = 1;
        row.last = body;
    }
    pruneSpam(now);
    return row.stamps.length >= SPAM_COUNT || row.same >= DUP_COUNT;
}

function isPrivileged(member) {
    return Boolean(
        member?.permissions?.has?.("ManageMessages")
        || member?.permissions?.has?.("ManageGuild")
        || member?.permissions?.has?.("Administrator")
    );
}

function fineFor(settings, key) {
    const n = Math.floor(Number(settings?.[key]) || 0);
    if (!Number.isFinite(n) || n < 0) {
        return 0;
    }
    return Math.min(n, 1_000_000_000);
}

function inspect(message, settings) {
    if (!settings || !message?.guild || isPrivileged(message.member)) {
        return null;
    }

    const text = String(message.content ?? "");
    const linksOn = settings.automodLinks || settings.automodInvites;
    const words = [
        ...(settings.automodSwear ? SWEARS : []),
        ...(settings.automodWordList || parseWords(settings.automodWords))
    ];

    if (settings.automodSpam && isSpam(message.guild.id, message.author.id, text)) {
        return { type: "spam", reason: "спам", fine: fineFor(settings, "automodFineSpam") };
    }
    if (linksOn && hasLink(text)) {
        return { type: "links", reason: "ссылка", fine: fineFor(settings, "automodFineLinks") };
    }
    const swearHit = words.length ? findBannedWord(text, words) : null;
    if (swearHit) {
        return { type: "swear", reason: `слово «${swearHit}»`, fine: fineFor(settings, "automodFineSwear") };
    }
    if (settings.automodCaps && isCaps(text)) {
        return { type: "caps", reason: "капс", fine: fineFor(settings, "automodFineCaps") };
    }

    return null;
}

function resetSpam() {
    spam.clear();
}

module.exports = {
    parseWords,
    hasInvite,
    hasLink,
    findBannedWord,
    isCaps,
    isSpam,
    isPrivileged,
    inspect,
    resetSpam
};
