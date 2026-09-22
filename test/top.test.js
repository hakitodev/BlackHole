const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeTopType, nextState, pageCount, parseTopId } = require("../Utils/top");

test("normalizeTopType", () => {
    assert.equal(normalizeTopType("level"), "level");
    assert.equal(normalizeTopType("уровень"), "level");
    assert.equal(normalizeTopType("money"), "money");
    assert.equal(normalizeTopType("деньги"), "money");
});

test("pageCount", () => {
    assert.equal(pageCount(0), 1);
    assert.equal(pageCount(10), 1);
    assert.equal(pageCount(11), 2);
});

test("nextState: стрелки и переключение типа", () => {
    assert.deepEqual(nextState("prev", "money", 0, 25), { type: "money", page: 0 });
    assert.deepEqual(nextState("next", "money", 0, 25), { type: "money", page: 1 });
    assert.deepEqual(nextState("next", "money", 2, 25), { type: "money", page: 2 });
    assert.deepEqual(nextState("type", "money", 2, 25), { type: "level", page: 0 });
    assert.deepEqual(nextState("type", "level", 1, 25), { type: "money", page: 0 });
});

test("parseTopId", () => {
    assert.deepEqual(parseTopId("top_next_level_1"), {
        action: "next",
        type: "level",
        page: 1
    });
});
