const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
    stripPrefix,
    splitCommand,
    tokenize,
    parseUserId,
    parseOptionValues
} = require("../Utils/prefix");

test("stripPrefix: обычный префикс и упоминание бота", () => {
    assert.equal(stripPrefix("!rob", "!", "99"), "rob");
    assert.equal(stripPrefix("! collect", "!", "99"), "collect");
    assert.equal(stripPrefix("<@99> top level", "!", "99"), "top level");
    assert.equal(stripPrefix("<@!99> pay 100", "!", "99"), "pay 100");
    assert.equal(stripPrefix("rob", "!", "99"), null);
    assert.equal(stripPrefix("bh!pay all", "bh!", "99"), "pay all");
});

test("splitCommand: имя и хвост", () => {
    assert.deepEqual(splitCommand("rob"), { name: "rob", rest: "" });
    assert.deepEqual(splitCommand("PAY 100"), { name: "pay", rest: "100" });
    assert.deepEqual(splitCommand("8ball will I win"), { name: "8ball", rest: "will I win" });
});

test("tokenize: упоминания и кавычки", () => {
    assert.deepEqual(tokenize("<@123456789012345678> 100"), [
        "<@123456789012345678>",
        "100"
    ]);
    assert.deepEqual(tokenize('"чай, кофе"'), ["чай, кофе"]);
});

test("parseUserId", () => {
    assert.equal(parseUserId("<@123456789012345678>"), "123456789012345678");
    assert.equal(parseUserId("123456789012345678"), "123456789012345678");
    assert.equal(parseUserId("100"), null);
});

test("parseOptionValues: rob берёт пользователя из ответа", () => {
    const parsed = parseOptionValues([], {
        options: [{ type: 6, name: "user", required: true }]
    }, "555");

    assert.equal(parsed.values.user.id, "555");
});

test("parseOptionValues: явное упоминание важнее ответа", () => {
    const parsed = parseOptionValues(["<@123456789012345678>"], {
        options: [{ type: 6, name: "user", required: true }]
    }, "555");

    assert.equal(parsed.values.user.id, "123456789012345678");
});

test("parseOptionValues: pay сумма, пользователь из ответа", () => {
    const parsed = parseOptionValues(["100"], {
        options: [
            { type: 3, name: "amount", required: true },
            { type: 6, name: "user" },
            { type: 3, name: "id" }
        ]
    }, "555");

    assert.equal(parsed.values.amount.value, "100");
    assert.equal(parsed.values.user.id, "555");
    assert.equal(parsed.values.id, null);
});

test("parseOptionValues: pay all из ответа", () => {
    const parsed = parseOptionValues(["all"], {
        options: [
            { type: 3, name: "amount", required: true },
            { type: 6, name: "user" },
            { type: 3, name: "id" }
        ]
    }, "555");

    assert.equal(parsed.values.amount.value, "all");
    assert.equal(parsed.values.user.id, "555");
});

test("parseOptionValues: give из ответа и суммы", () => {
    const parsed = parseOptionValues(["250"], {
        options: [
            { type: 6, name: "user", required: true },
            { type: 3, name: "amount", required: true }
        ]
    }, "555");

    assert.equal(parsed.values.user.id, "555");
    assert.equal(parsed.values.amount.value, "250");
});

test("parseOptionValues: mod subcommand", () => {
    const parsed = parseOptionValues(["add", "<@123456789012345678>"], {
        options: [
            {
                type: 1,
                name: "add",
                options: [{ type: 6, name: "user", required: true }]
            },
            { type: 1, name: "list" }
        ]
    }, null);

    assert.equal(parsed.sub, "add");
    assert.equal(parsed.values.user.id, "123456789012345678");
});

test("parseOptionValues: 8ball забирает весь хвост", () => {
    const parsed = parseOptionValues(["я", "выиграю", "?"], {
        options: [{ type: 3, name: "question", required: true }]
    }, null);

    assert.equal(parsed.values.question.value, "я выиграю ?");
});

test("parseOptionValues: без цели и без ответа", () => {
    const parsed = parseOptionValues([], {
        options: [{ type: 6, name: "user", required: true }]
    }, null);

    assert.equal(parsed.values.user, null);
});
