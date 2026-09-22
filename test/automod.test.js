const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseWords, hasInvite, findBannedWord } = require("../Utils/automod");
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

test("fill плейсхолдеры", () => {
    const text = fill("{user} на {server}, {count}, {level}", {
        user: { id: "1" },
        guild: { name: "Home", memberCount: 12 },
        level: 4
    });
    assert.equal(text, "<@1> на Home, 12, 4");
});
