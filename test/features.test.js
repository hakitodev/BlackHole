const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const economy = require("../Database/Economy");
const { isDisabled } = require("../Utils/commands");
const { RANK, rankLabel, staffRank } = require("../Utils/staff");

let dir;

before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "blackhole-feat-"));
    await economy.initDatabase(path.join(dir, "feat.sqlite"));
});

after(async () => {
    await economy.closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
});

test("ранги модеров: мод и высший", async () => {
    const first = await economy.addStaff("mod-1", "owner", 1);
    assert.equal(first.created, true);
    assert.equal(first.rank, 1);
    assert.equal(await economy.getStaffRank("mod-1"), 1);

    const up = await economy.addStaff("mod-1", "owner", 2);
    assert.equal(up.created, false);
    assert.equal(await economy.getStaffRank("mod-1"), 2);
    assert.equal(rankLabel(2), "высший модератор");
    assert.equal(await staffRank("mod-1"), RANK.senior);
});

test("ивенты пишутся по одному и не затирают соседний", async () => {
    const guild = "555666777888999111";
    await economy.saveGuildEvent(guild, "join", {
        enabled: true,
        channel: "123456789012345678",
        message: "вход"
    });
    await economy.saveGuildEvent(guild, "leave", {
        enabled: true,
        channel: "123456789012345679",
        message: "выход"
    });
    await economy.saveGuildEvent(guild, "join", { message: "новый вход" });

    const join = await economy.getGuildEvent(guild, "join");
    const leave = await economy.getGuildEvent(guild, "leave");
    assert.equal(join.message, "новый вход");
    assert.equal(join.channel, "123456789012345678");
    assert.equal(leave.message, "выход");
    assert.equal(leave.enabled, true);
});

test("ивент без записи берёт старый welcome", async () => {
    const guild = "111000222333444777";
    await economy.saveGuildSettings(guild, {
        welcomeOn: true,
        welcomeChannel: "123456789012345678",
        welcomeMessage: "хай"
    });
    const join = await economy.getGuildEvent(guild, "join");
    assert.equal(join.enabled, true);
    assert.equal(join.message, "хай");
});

test("шоп: глобальный + серверный с тем же id", async () => {
    await economy.saveShopItem("global", {
        id: "gem",
        name: "Гем",
        emoji: "💎",
        price: 10,
        description: "мир"
    });
    await economy.saveShopItem("g1", {
        id: "gem",
        name: "Гем сервера",
        emoji: "💠",
        price: 5,
        description: "свой"
    });

    const global = await economy.getShopItem(null, "gem");
    const local = await economy.getShopItem("g1", "gem");
    assert.equal(global.name, "Гем");
    assert.equal(local.name, "Гем сервера");
    assert.equal(local.price, 5);

    const merged = await economy.listShop("g1");
    assert.equal(merged.find(item => item.id === "gem").name, "Гем сервера");
});

test("кастом-команда хранит эмбед", async () => {
    const saved = await economy.saveCustomCommand("g2", "hello", {
        title: "Йо",
        response: "Привет, {user}",
        color: "#112233",
        footer: "bh"
    });
    assert.equal(saved.ok, true);
    const row = await economy.getCustomCommand("g2", "hello");
    assert.equal(row.title, "Йо");
    assert.equal(row.color, "#112233");
    assert.equal(row.footer, "bh");
});

test("setWallet ставит наличные и банк", async () => {
    const user = await economy.setWallet("eco-1", { balance: 40, bank: 15 });
    assert.equal(user.balance, 40);
    assert.equal(user.bank, 15);
});

test("выключенные команды", () => {
    const settings = { disabledCommands: ["flip", "help", "rob"] };
    assert.equal(isDisabled(settings, "flip"), true);
    assert.equal(isDisabled(settings, "cf"), true);
    assert.equal(isDisabled(settings, "help"), true);
    assert.equal(isDisabled(settings, "collect"), false);
});

test("seed глобального шопа не пустой", async () => {
    const items = await economy.listShopItems("global");
    assert.ok(items.length >= 7);
    assert.ok(items.some(item => item.id === "coffee"));
});

test("уровень сыпет монеты", async () => {
    const id = "lvl-pay";
    await economy.addXp(id, 1000, 250);
    const user = await economy.getUser(id);
    assert.ok(user.level > 1);
    assert.ok(user.balance >= 250);
});

test("setUser и инвентарь", async () => {
    const id = "full-user";
    await economy.setUser(id, { balance: 5, bank: 7, xp: 3, level: 2 });
    const user = await economy.getUser(id);
    assert.equal(user.balance, 5);
    assert.equal(user.level, 2);
    await economy.setInventoryItem(id, "coffee", 4);
    const inv = await economy.getInventory(id);
    assert.equal(inv[0].qty, 4);
    await economy.deleteUser(id);
    const gone = await economy.getUser(id);
    assert.equal(gone.balance, 0);
});
