const ECONOMY = new Set([
    "pay", "dep", "with", "flip", "rob", "bal", "profile", "rank", "top",
    "shop", "buy", "inv", "btc", "box", "biz", "job", "collect",
    "give", "take", "eco"
]);

const EARN = new Set(["collect", "biz", "job", "btc", "box", "buy"]);

function isEconomyCommand(name) {
    return ECONOMY.has(String(name || ""));
}

function isEarnCommand(name) {
    return EARN.has(String(name || ""));
}

module.exports = {
    ECONOMY,
    EARN,
    isEconomyCommand,
    isEarnCommand
};
