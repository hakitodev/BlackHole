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

test("ивенты покрывают войса и таймаут", () => {
    const ids = EVENT_TYPES.map(item => item.id);
    for (const name of ["timeout", "nick", "roleAdd", "voiceJoin", "inviteCreate", "messageBulkDelete", "threadCreate"]) {
        assert.ok(ids.includes(name), name);
    }
});
