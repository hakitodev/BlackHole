const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseAmount, isAll } = require("../Utils/amount");

test("parseAmount: число", () => {
    assert.deepEqual(parseAmount("150", { available: 200 }), {
        ok: true,
        amount: 150,
        all: false
    });
});

test("parseAmount: all берёт доступное", () => {
    assert.equal(isAll("все"), true);
    assert.deepEqual(parseAmount("all", { available: 320 }), {
        ok: true,
        amount: 320,
        all: true
    });
});

test("parseAmount: all с потолком", () => {
    assert.deepEqual(parseAmount("all", { available: 50000, min: 10, max: 10000 }), {
        ok: true,
        amount: 10000,
        all: true
    });
});

test("parseAmount: all меньше минимума", () => {
    assert.equal(parseAmount("all", { available: 5, min: 10 }).ok, false);
});

test("parseAmount: отрицательные, дроби и мусор", () => {
    assert.equal(parseAmount("-100", { available: 500 }).ok, false);
    assert.equal(parseAmount("1.5", { available: 500 }).ok, false);
    assert.equal(parseAmount("1e2", { available: 500 }).ok, false);
    assert.equal(parseAmount("+10", { available: 500 }).ok, false);
    assert.equal(parseAmount("10 000", { available: 500 }).ok, false);
    assert.equal(parseAmount("abc").ok, false);
    assert.equal(parseAmount("").ok, false);
});

test("parseAmount: overflow и floor", () => {
    assert.equal(parseAmount("9007199254740993").ok, false);
    assert.equal(parseAmount("1" + "0".repeat(20)).ok, false);
    assert.deepEqual(parseAmount("42", { available: 100 }), {
        ok: true,
        amount: 42,
        all: false
    });
});

test("parseAmount: максимум ставки", () => {
    assert.equal(parseAmount("30000", { max: 25000, available: 100000 }).ok, false);
    assert.equal(parseAmount("30000", { max: 25000, available: 100000 }).reason, "max");
    assert.deepEqual(parseAmount("all", { available: 90000, max: 25000 }), {
        ok: true,
        amount: 25000,
        all: true
    });
});
