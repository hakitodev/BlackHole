const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const economy = require("../Database/Economy");

let dir;
let n = 0;

function uid(prefix = "user") {
    n += 1;
    return `${prefix}-${n}`;
}

async function cash(id) {
    return (await economy.getUser(id)).balance;
}

before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "blackhole-"));
    await economy.initDatabase(path.join(dir, "test.sqlite"));
});

after(async () => {
    await economy.closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
});

test("transfer: переводит наличные и не трогает банк", async () => {
    const from = uid("pay");
    const to = uid("pay");

    await economy.addBalance(from, 200);
    await economy.deposit(from, 70);

    const result = await economy.transfer(from, to, 100);

    assert.equal(result.ok, true);
    assert.equal(await cash(from), 30);
    assert.equal((await economy.getUser(from)).bank, 70);
    assert.equal(await cash(to), 100);
});

test("transfer: не хватает наличных", async () => {
    const from = uid("pay");
    const to = uid("pay");

    await economy.addBalance(from, 40);

    const result = await economy.transfer(from, to, 50);

    assert.equal(result.ok, false);
    assert.equal(result.reason, "insufficient");
    assert.equal(await cash(from), 40);
    assert.equal(await cash(to), 0);
});

test("transfer: параллельные переводы не тратят больше баланса", async () => {
    const from = uid("race");
    const a = uid("race");
    const b = uid("race");

    await economy.addBalance(from, 100);

    const results = await Promise.all([
        economy.transfer(from, a, 80),
        economy.transfer(from, b, 80)
    ]);

    const ok = results.filter(result => result.ok);
    assert.equal(ok.length, 1);

    const total =
        (await cash(from)) +
        (await cash(a)) +
        (await cash(b));

    assert.equal(total, 100);
    assert.ok((await cash(from)) >= 0);
});

test("rob: успешная кража только с наличных", async () => {
    const robber = uid("rob");
    const victim = uid("rob");

    await economy.addBalance(victim, 400);
    await economy.deposit(victim, 200);

    const result = await economy.attemptRob(
        robber,
        victim,
        90 * 60 * 1000,
        true,
        120,
        80
    );

    assert.equal(result.ok, true);
    assert.equal(result.success, true);
    assert.equal(result.amount, 120);
    assert.equal(await cash(robber), 120);
    assert.equal(await cash(victim), 80);
    assert.equal((await economy.getUser(victim)).bank, 200);
});

test("rob: провал — штраф жертве, если хватает денег", async () => {
    const robber = uid("rob");
    const victim = uid("rob");

    await economy.addBalance(robber, 150);
    await economy.addBalance(victim, 80);

    const result = await economy.attemptRob(
        robber,
        victim,
        90 * 60 * 1000,
        false,
        100,
        90
    );

    assert.equal(result.ok, true);
    assert.equal(result.success, false);
    assert.equal(result.wiped, false);
    assert.equal(result.amount, 90);
    assert.equal(await cash(robber), 60);
    assert.equal(await cash(victim), 170);
});

test("rob: провал без наличных обнуляет кошелёк", async () => {
    const robber = uid("rob");
    const victim = uid("rob");

    await economy.addBalance(victim, 80);

    const result = await economy.attemptRob(
        robber,
        victim,
        90 * 60 * 1000,
        false,
        100,
        90
    );

    assert.equal(result.ok, true);
    assert.equal(result.success, false);
    assert.equal(result.wiped, true);
    assert.equal(await cash(robber), 0);
    assert.equal(await cash(victim), 80);
});

test("rob: у цели мало наличных", async () => {
    const robber = uid("rob");
    const victim = uid("rob");

    await economy.addBalance(victim, 0);
    await economy.deposit(victim, 500);

    const result = await economy.attemptRob(
        robber,
        victim,
        90 * 60 * 1000,
        true,
        20,
        50
    );

    assert.equal(result.ok, false);
    assert.equal(result.reason, "empty");
    assert.equal(await cash(robber), 0);
    assert.equal(await cash(victim), 0);
});

test("rob: кулдаун не списывает деньги повторно", async () => {
    const robber = uid("rob");
    const first = uid("rob");
    const second = uid("rob");

    await economy.addBalance(first, 200);
    await economy.addBalance(second, 200);

    const firstRob = await economy.attemptRob(
        robber,
        first,
        90 * 60 * 1000,
        true,
        50,
        40
    );
    const secondRob = await economy.attemptRob(
        robber,
        second,
        90 * 60 * 1000,
        true,
        50,
        40
    );

    assert.equal(firstRob.ok, true);
    assert.equal(secondRob.ok, false);
    assert.equal(secondRob.reason, "cooldown");
    assert.equal(await cash(robber), 50);
    assert.equal(await cash(second), 200);
});

test("rob: параллельные кражи не забирают больше, чем есть", async () => {
    const victim = uid("rob");
    const r1 = uid("rob");
    const r2 = uid("rob");

    await economy.addBalance(victim, 100);
    await economy.addBalance(r1, 100);
    await economy.addBalance(r2, 100);

    const results = await Promise.all([
        economy.attemptRob(r1, victim, 0, true, 80, 10),
        economy.attemptRob(r2, victim, 0, true, 80, 10)
    ]);

    const taken = results
        .filter(result => result.ok && result.success)
        .reduce((sum, result) => sum + result.amount, 0);

    assert.ok(taken <= 100);

    const total =
        (await cash(victim)) +
        (await cash(r1)) +
        (await cash(r2));

    assert.equal(total, 300);
    assert.ok((await cash(victim)) >= 0);
});

test("flip: выигрыш удваивает ставку", async () => {
    const id = uid("flip");
    await economy.addBalance(id, 250);

    const result = await economy.flipBet(id, 100, true);

    assert.equal(result.ok, true);
    assert.equal(result.win, true);
    assert.equal(await cash(id), 350);
});

test("flip: проигрыш забирает ставку", async () => {
    const id = uid("flip");
    await economy.addBalance(id, 250);

    const result = await economy.flipBet(id, 100, false);

    assert.equal(result.ok, true);
    assert.equal(result.win, false);
    assert.equal(await cash(id), 150);
});

test("flip: нельзя поставить больше наличных", async () => {
    const id = uid("flip");
    await economy.addBalance(id, 20);

    const result = await economy.flipBet(id, 50, true);

    assert.equal(result.ok, false);
    assert.equal(result.reason, "insufficient");
    assert.equal(await cash(id), 20);
});

test("flip: параллельные ставки не уходят в минус", async () => {
    const id = uid("flip");
    await economy.addBalance(id, 100);

    // Проигрыш: иначе первая победа пополнит баланс и вторая ставка тоже пройдёт.
    const results = await Promise.all([
        economy.flipBet(id, 100, false),
        economy.flipBet(id, 100, false)
    ]);

    assert.equal(results.filter(result => result.ok).length, 1);
    assert.equal(await cash(id), 0);
});

test("getTop: страницы по offset", async () => {
    const ids = [];

    for (let i = 0; i < 12; i++) {
        const id = uid("lb");
        ids.push(id);
        await economy.addBalance(id, 500000 - i);
    }

    const page0 = await economy.getTop(10, "money", 0);
    const page1 = await economy.getTop(10, "money", 10);

    assert.equal(page0.length, 10);
    assert.equal(page0[0].id, ids[0]);
    assert.equal(page0[9].id, ids[9]);
    assert.ok(page1.some(user => user.id === ids[10]));
    assert.ok((await economy.countUsers()) >= 12);
});

test("deposit/withdraw all через полный баланс", async () => {
    const id = uid("all");
    await economy.addBalance(id, 400);

    assert.equal((await economy.deposit(id, 400)).ok, true);
    assert.equal(await cash(id), 0);
    assert.equal((await economy.getUser(id)).bank, 400);

    assert.equal((await economy.withdraw(id, 400)).ok, true);
    assert.equal(await cash(id), 400);
    assert.equal((await economy.getUser(id)).bank, 0);
});

test("префикс на сервере по умолчанию включён и выключается", async () => {
    const guild = "guild-1";
    assert.equal(await economy.isPrefixEnabled(guild), true);

    await economy.setPrefixEnabled(guild, false);
    assert.equal(await economy.isPrefixEnabled(guild), false);

    await economy.setPrefixEnabled(guild, true);
    assert.equal(await economy.isPrefixEnabled(guild), true);
});
