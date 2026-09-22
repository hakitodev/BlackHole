const GLOBAL_SCOPE = "global";

function normScope(scope) {
    const value = String(scope ?? GLOBAL_SCOPE).trim();
    return value && value !== "undefined" ? value : GLOBAL_SCOPE;
}

function isGuildScope(scope) {
    return normScope(scope) !== GLOBAL_SCOPE;
}

function walletScope(settings, guildId) {
    if (settings?.walletScope === "guild" && guildId) {
        return String(guildId);
    }
    return GLOBAL_SCOPE;
}

async function forGuild(guildId) {
    const economy = require("../Database/Economy");
    const settings = guildId ? await economy.getGuildSettings(guildId) : {};
    return {
        settings,
        scope: walletScope(settings, guildId)
    };
}

async function forInteraction(interaction) {
    return forGuild(interaction?.guildId || interaction?.guild?.id);
}

module.exports = {
    GLOBAL_SCOPE,
    normScope,
    isGuildScope,
    walletScope,
    forGuild,
    forInteraction
};
