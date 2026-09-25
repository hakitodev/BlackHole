const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseWords, hasInvite, hasLink, isCaps, inspect, resetSpam, findBannedWord } = require("../Utils/automod");
const { fill } = require("../Utils/placeholders");

test("parseWords: строки и запятые", () => {
    assert.deepEqual(parseWords("spam, BAD\ninvite"), ["spam", "bad", "invite"]);
});

test("hasInvite", () => {
    assert.equal(hasInvite("зайди discord.gg/abc"), true);
    assert.equal(hasInvite("https://discord.com/invite/abc"), true);
    assert.equal(hasInvite("просто текст"), false);
});

test("findBannedWord", () => {
    assert.equal(findBannedWord("это spam тут", ["spam"]), "spam");
    assert.equal(findBannedWord("ок", ["spam"]), null);
});

test("ссылки, капс и штраф из кэша настроек", () => {
    resetSpam();
    const guild = { id: "g1" };
    const author = { id: "u1" };
    const base = {
        automodLinks: true,
        automodSpam: true,
        automodSwear: true,
        automodCaps: true,
        automodFineLinks: 40,
        automodFineSpam: 15,
        automodFineSwear: 25,
        automodFineCaps: 5,
        automodWords: ""
    };
    assert.equal(hasLink("смотри https://example.com/a"), true);
    assert.equal(isCaps("ЭТО ПРОСТО КАПС"), true);
    assert.equal(inspect({
        guild,
        author,
        content: "https://example.com",
        member: { permissions: { has: () => false } }
    }, base).type, "links");
    assert.equal(inspect({
        guild,
        author,
        content: "ну ты сука",
        member: { permissions: { has: () => false } }
    }, base).fine, 25);
    assert.equal(inspect({
        guild,
        author,
        content: "ЭТО ПРОСТО КАПС",
        member: { permissions: { has: () => false } }
    }, base).type, "caps");
    const mod = {
        guild,
        author,
        content: "https://example.com",
        member: { permissions: { has: () => true } }
    };
    assert.equal(inspect(mod, base), null);
});

test("fill плейсхолдеры", () => {
    const text = fill("{user} на {server}, {count}, {level}", {
        user: { id: "1" },
        guild: { name: "Home", memberCount: 12 },
        level: 4
    });
    assert.equal(text, "<@1> на Home, 12, 4");
});
