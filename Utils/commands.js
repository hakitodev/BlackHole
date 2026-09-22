const RESTRICTABLE = [
    { id: "collect", title: "collect — ежедневка / работа / криминал" },
    { id: "bal", title: "bal — баланс" },
    { id: "rob", title: "rob — ограбление" },
    { id: "pay", title: "pay — перевод" },
    { id: "flip", title: "flip — орёл/решка" },
    { id: "dep", title: "dep — в банк" },
    { id: "with", title: "with — из банка" },
    { id: "top", title: "top — топ" },
    { id: "profile", title: "profile — профиль" },
    { id: "rank", title: "rank — уровень" },
    { id: "shop", title: "shop — магазин" },
    { id: "buy", title: "buy — покупка" },
    { id: "inv", title: "inv — инвентарь" },
    { id: "8ball", title: "8ball" },
    { id: "roll", title: "roll" },
    { id: "pick", title: "pick" },
    { id: "ping", title: "ping" },
    { id: "avatar", title: "avatar" },
    { id: "user", title: "user" },
    { id: "server", title: "server" },
    { id: "authpanel", title: "authpanel" },
    { id: "clear", title: "clear" },
    { id: "slowmode", title: "slowmode" }
];

const LOCKED = new Set(["help", "settings", "mod", "give", "take", "eco"]);

const ALIASES = {
    balance: "bal",
    deposit: "dep",
    withdraw: "with",
    inventory: "inv",
    coinflip: "flip",
    cf: "flip",
    ball: "8ball",
    eightball: "8ball",
    daily: "collect",
    work: "collect",
    crime: "collect",
    steal: "rob",
    config: "settings",
    commands: "help",
    cmds: "help"
};

function canonicalName(name) {
    const key = String(name ?? "").toLowerCase();
    return ALIASES[key] || key;
}

function isDisabled(settings, name) {
    const key = canonicalName(name);
    if (LOCKED.has(key)) {
        return false;
    }
    const list = settings?.disabledCommands || [];
    return list.includes(key) || list.includes(String(name ?? "").toLowerCase());
}

module.exports = {
    RESTRICTABLE,
    LOCKED,
    canonicalName,
    isDisabled
};
