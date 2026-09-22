const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const economy = require("../Database/Economy");
const { runCollect, formatCollect } = require("../Utils/collect");

let dir;
let n = 0;

function uid() {
    n += 1;
    return `collect-${n}`;
}

before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "blackhole-collect-"));
    await economy.initDatabase(path.join(dir, "test.sqlite"));
});

after(async () => {
    await economy.closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
});

test("collect daily выдаёт отдельно", async () => {
    const id = uid();
    const result = await runCollect(id, "daily");

    assert.equal(result.claimed, true);
    assert.equal(result.parts[0].id, "daily");
    assert.equal(result.parts[0].ok, true);
    assert.ok(result.parts[0].amount >= 300);
    assert.ok(result.parts[0].amount <= 1100);
    assert.equal(result.balance, result.parts[0].amount);
    assert.match(formatCollect(result), /Ежедневка/);
});

test("collect work и crime отдельно, диапазон с гильдии", async () => {
    const id = uid();
    await economy.saveGuildSettings("g-col", {
        workMin: 10,
        workMax: 10,
        crimeMin: 50,
        crimeMax: 50,
        crimeFineMin: 1,
        crimeFineMax: 1
    });
    const settings = await economy.getGuildSettings("g-col");
    const work = await runCollect(id, "work", { settings });
    assert.equal(work.parts[0].ok, true);
    assert.equal(work.parts[0].amount, 10);

    const crime = await runCollect(id, "crime", { settings, random: () => 0 });
    assert.equal(crime.parts[0].ok, true);
    assert.equal(crime.parts[0].success, true);
    assert.equal(crime.parts[0].amount, 50);
});

test("collect daily повторно не выдаёт, пока кулдаун", async () => {
    const id = uid();
    await runCollect(id, "daily");
    const again = await runCollect(id, "daily");

    assert.equal(again.claimed, false);
    assert.equal(again.parts[0].ok, false);
    assert.match(formatCollect(again), /через/);
});

test("collect crime провал не трогает daily", async () => {
    const id = uid();
    const daily = await runCollect(id, "daily");
    const crime = await runCollect(id, "crime", { random: () => 0.99 });

    assert.equal(daily.parts[0].ok, true);
    assert.equal(crime.parts[0].ok, true);
    assert.equal(crime.parts[0].success, false);
    const user = await economy.getUser(id);
    assert.ok(user.balance <= daily.parts[0].amount);
});
