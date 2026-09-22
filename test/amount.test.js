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

test("parseAmount: мусор", () => {
    assert.equal(parseAmount("abc").ok, false);
    assert.equal(parseAmount("").ok, false);
});
