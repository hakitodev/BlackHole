const COMMANDS = [
    { id: "collect", title: "collect" },
    { id: "bal", title: "bal" },
    { id: "rob", title: "rob" },
    { id: "pay", title: "pay" },
    { id: "flip", title: "flip" },
    { id: "dep", title: "dep" },
    { id: "with", title: "with" },
    { id: "top", title: "top" },
    { id: "profile", title: "profile" },
    { id: "rank", title: "rank" },
    { id: "shop", title: "shop" },
    { id: "buy", title: "buy" },
    { id: "inv", title: "inv" },
    { id: "8ball", title: "8ball" },
    { id: "roll", title: "roll" },
    { id: "pick", title: "pick" },
    { id: "ping", title: "ping" },
    { id: "avatar", title: "avatar" },
    { id: "user", title: "user" },
    { id: "server", title: "server" },
    { id: "authpanel", title: "authpanel" },
    { id: "clear", title: "clear" },
    { id: "slowmode", title: "slowmode" },
    { id: "settings", title: "settings" },
    { id: "help", title: "help" },
    { id: "give", title: "give" },
    { id: "take", title: "take" },
    { id: "eco", title: "eco" },
    { id: "mod", title: "mod" }
];

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
    const list = settings?.disabledCommands || [];
    return list.includes(key) || list.includes(String(name ?? "").toLowerCase());
}

module.exports = {
    COMMANDS,
    RESTRICTABLE: COMMANDS,
    canonicalName,
    isDisabled
};
