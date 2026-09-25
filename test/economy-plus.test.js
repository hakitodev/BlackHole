const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const economy = require("../Database/Economy");
const { getBusiness } = require("../Utils/business");
const { getBox, roll } = require("../Utils/boxes");
const { isDisabled } = require("../Utils/commands");
const { EVENT_TYPES } = require("../Utils/events");
const settingsCache = require("../Utils/settingsCache");

let dir;
let n = 0;

function uid() {
    n += 1;
    return `eco2-${n}`;
}

before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "blackhole-eco2-"));
    await economy.initDatabase(path.join(dir, "eco2.sqlite"));
});

after(async () => {
    await economy.closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
});

test("btc: покупка и продажа атомарно", async () => {
    const id = uid();
    await economy.setKv("btc_price", "8000");
    await economy.addBalance(id, 40000);
    const buy = await economy.buyBtc(id, 3);
    assert.equal(buy.ok, true);
    assert.equal(buy.cost, 24000);
    const user = await economy.getUser(id);
    assert.equal(user.btc, 3);
    assert.equal(user.balance, 16000);

    const sell = await economy.sellBtc(id, 2);
    assert.equal(sell.ok, true);
    assert.equal((await economy.getUser(id)).btc, 1);
    assert.equal((await economy.getUser(id)).balance, 32000);
});

test("btc: параллельная покупка не уходит в минус", async () => {
    const id = uid();
    await economy.setKv("btc_price", "8000");
    await economy.addBalance(id, 8000);
    const results = await Promise.all([
        economy.buyBtc(id, 1),
        economy.buyBtc(id, 1)
    ]);
    assert.equal(results.filter(item => item.ok).length, 1);
    const user = await economy.getUser(id);
    assert.equal(user.btc, 1);
    assert.equal(user.balance, 0);
});

test("бокс открывается из инвентаря", async () => {
    const id = uid();
    const box = getBox("box_wood");
    assert.ok(box);
    await economy.setInventoryItem(id, box.id, 1);
    const loot = roll(box, () => 0.99);
    const opened = await economy.openBox(id, box.id, loot.amount);
    assert.equal(opened.ok, true);
    assert.equal((await economy.getUser(id)).balance, loot.amount);
    assert.equal((await economy.getInventory(id)).length, 0);
});

test("бокс: параллельный open не дюпает", async () => {
    const id = uid();
    await economy.setInventoryItem(id, "box_wood", 1);
    const results = await Promise.all([
        economy.openBox(id, "box_wood", 40),
        economy.openBox(id, "box_wood", 40)
    ]);
    assert.equal(results.filter(item => item.ok).length, 1);
    assert.equal((await economy.getUser(id)).balance, 40);
    assert.equal((await economy.getInventory(id)).length, 0);
});

test("бокс: дроп монет из таблицы внутри транзакции", async () => {
    const id = uid();
    await economy.saveBox("global", { id: "box_test", name: "Тест", emoji: "📦" });
    await economy.saveDrop("global", "box_test", { kind: "coins", weight: 1, min: 50, max: 50 });
    await economy.setInventoryItem(id, "box_test", 1);
    const opened = await economy.openBox(id, "box_test");
    assert.equal(opened.ok, true);
    assert.equal(opened.amount, 50);
    assert.equal((await economy.getUser(id)).balance, 50);
});

test("бокс: свиток профессии и буст бизнеса", async () => {
    const id = uid();
    const def = getBusiness("stall");
    await economy.addBalance(id, def.price);
    await economy.buyBusiness(id, def.id, def);
    await economy.setJob(id, "intern");
    await economy.saveBox("global", { id: "box_scroll", name: "Свиток", emoji: "📜" });
    await economy.saveDrop("global", "box_scroll", { kind: "job_xp", weight: 1, steps: 1 });
    await economy.setInventoryItem(id, "box_scroll", 1);
    const jobDrop = await economy.openBox(id, "box_scroll");
    assert.equal(jobDrop.ok, true);
    assert.equal((await economy.getUser(id)).job, "courier");

    await economy.saveBox("global", { id: "box_boost", name: "Буст", emoji: "📈" });
    await economy.saveDrop("global", "box_boost", { kind: "biz_boost", weight: 1, percent: 100, type: "stall" });
    await economy.setInventoryItem(id, "box_boost", 1);
    const boost = await economy.openBox(id, "box_boost");
    assert.equal(boost.ok, true);
    const later = Date.now() + 60 * 60 * 1000;
    const peek = await economy.peekBusiness(id, def.id, def, later);
    const base = Math.floor((def.income / 60) * 3600);
    assert.ok(peek.unclaimed > base);
    assert.ok(peek.unclaimed <= def.cap);
});

test("бизнес: купить, кап, collect", async () => {
    const id = uid();
    const def = getBusiness("stall");
    await economy.addBalance(id, def.price);
    const bought = await economy.buyBusiness(id, def.id, def);
    assert.equal(bought.ok, true);

    const empty = await economy.collectBusiness(id, def.id, def);
    assert.equal(empty.ok, false);

    const now = Date.now() + 10 * 60 * 1000;
    const peek = await economy.peekBusiness(id, def.id, def, now);
    assert.ok(peek.unclaimed > 0);
    assert.ok(peek.unclaimed <= def.cap);
});

test("бизнес: доход считается по timestamp", async () => {
    const id = uid();
    const def = getBusiness("stall");
    await economy.addBalance(id, def.price);
    await economy.buyBusiness(id, def.id, def);
    const later = Date.now() + 60 * 60 * 1000;
    const peek = await economy.peekBusiness(id, def.id, def, later);
    const expected = Math.floor((def.income / 60) * 3600);
    assert.equal(peek.unclaimed, Math.min(def.cap, expected));
    assert.equal(peek.stalled, false);
});

test("бизнес: простой после 24ч, без cron", async () => {
    const id = uid();
    const def = getBusiness("stall");
    await economy.addBalance(id, def.price + 500);
    await economy.buyBusiness(id, def.id, def);
    const later = Date.now() + 25 * 60 * 60 * 1000;
    const peek = await economy.peekBusiness(id, def.id, def, later, { penaltiesOn: true });
    assert.equal(peek.stalled, true);
    const collect = await economy.collectBusiness(id, def.id, def, { now: later, penaltiesOn: true });
    assert.equal(collect.ok, false);
    assert.equal(collect.reason, "stalled");
    const restart = await economy.restartBusiness(id, def.id, def);
    assert.equal(restart.ok, true);
});

test("гильдийный кошелёк не трогает глобальный", async () => {
    const id = uid();
    await economy.addBalance(id, 500);
    await economy.addBalance(id, 80, "guild-1");
    assert.equal((await economy.getUser(id)).balance, 500);
    assert.equal((await economy.getUser(id, "guild-1")).balance, 80);
    await economy.transfer(id, uid(), 100);
    assert.equal((await economy.getUser(id, "guild-1")).balance, 80);
});

test("работа: увольнение за простой 36ч", async () => {
    const id = uid();
    await economy.setJob(id, "dev");
    await economy.setUser(id, { lastWork: Date.now() - 37 * 60 * 60 * 1000 });
    const result = await economy.applyIdlePenalties(id, "global", { penaltiesOn: true });
    assert.equal(result.fired, true);
    assert.equal((await economy.getUser(id)).job, "intern");
});

test("rob: куш режется системным лимитом", async () => {
    const robber = uid();
    const victim = uid();
    await economy.addBalance(victim, 200000);
    const result = await economy.attemptRob(
        robber,
        victim,
        0,
        true,
        80000,
        80
    );
    assert.equal(result.ok, true);
    assert.equal(result.amount, 15000);
});

test("ник пишется в базу и ищется", async () => {
    const id = "397351234567890123";
    await economy.touchProfile(id, { username: "Kitoha" });
    const found = await economy.searchUsers("kito");
    assert.ok(found.some(item => item.id === id && item.username === "Kitoha"));
});

test("daily/work/crime выключаются отдельно от collect", () => {
    const settings = { disabledCommands: ["crime", "rob"] };
    assert.equal(isDisabled(settings, "crime"), true);
    assert.equal(isDisabled(settings, "collect"), false);
    assert.equal(isDisabled(settings, "rob"), true);
    assert.equal(isDisabled(settings, "daily"), false);
});

test("штраф автомода списывает в транзакции и не уходит в минус", async () => {
    const id = uid();
    const guild = "555000111222333444";
    await economy.addBalance(id, 30);
    await economy.saveGuildSettings(guild, {
        automodLinks: true,
        automodFineLinks: 100
    });
    economy.warmGuildCache();
    const cached = settingsCache.get(guild);
    assert.equal(cached.automodLinks, true);
    assert.equal(cached.automodFineLinks, 100);
    const first = economy.applyAutomodFine(id, 100);
    const second = economy.applyAutomodFine(id, 100);
    assert.equal(first.taken, 30);
    assert.equal(second.taken, 0);
    assert.equal((await economy.getUser(id)).balance, 0);
});

test("ивенты покрывают войса и таймаут", () => {
    const ids = EVENT_TYPES.map(item => item.id);
    for (const name of ["timeout", "nick", "roleAdd", "voiceJoin", "inviteCreate", "messageBulkDelete", "threadCreate"]) {
        assert.ok(ids.includes(name), name);
    }
});
