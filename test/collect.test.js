const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const economy = require("../Database/Economy");
const { runCollect, formatCollect, DAILY_REWARD } = require("../Utils/collect");

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

test("collect: забирает daily, work и crime разом", async () => {
    const id = uid();
    const result = await runCollect(id, () => 0);

    assert.equal(result.claimed, true);
    assert.equal(result.parts[0].ok, true);
    assert.equal(result.parts[0].amount, DAILY_REWARD);
    assert.equal(result.parts[1].ok, true);
    assert.equal(result.parts[2].ok, true);
    assert.equal(result.parts[2].success, true);

    const expected = result.parts
        .filter(part => part.ok && part.amount && (part.id !== "crime" || part.success))
        .reduce((sum, part) => sum + part.amount, 0);

    assert.equal(result.balance, expected);
    assert.match(formatCollect(result), /Ежедневка/);
});

test("collect: повторно не выдаёт, пока кулдаун", async () => {
    const id = uid();
    await runCollect(id, () => 0);
    const again = await runCollect(id, () => 0);

    assert.equal(again.claimed, false);
    assert.equal(again.parts.every(part => !part.ok), true);
    assert.match(formatCollect(again), /через/);
});

test("collect: провал crime не отменяет daily и work", async () => {
    const id = uid();
    const result = await runCollect(id, () => 0.99);

    assert.equal(result.parts[0].ok, true);
    assert.equal(result.parts[1].ok, true);
    assert.equal(result.parts[2].ok, true);
    assert.equal(result.parts[2].success, false);
    assert.ok(result.balance >= 0);
    assert.ok(result.balance < DAILY_REWARD + result.parts[1].amount);
});
