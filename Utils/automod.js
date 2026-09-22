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
    findBannedWord,
    isPrivileged
};
