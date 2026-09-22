const { test } = require("node:test");
const assert = require("node:assert/strict");
const { canManageGuild, escapeHtml, parseForm } = require("../Web/access");

test("canManageGuild: админ, manage guild и владелец", () => {
    assert.equal(canManageGuild("8"), true);
    assert.equal(canManageGuild("32"), true);
    assert.equal(canManageGuild("0", true), true);
    assert.equal(canManageGuild("0"), false);
    assert.equal(canManageGuild("2147483647"), true);
    assert.equal(canManageGuild("not-a-number"), false);
});

test("escapeHtml экранирует разметку", () => {
    assert.equal(
        escapeHtml(`<script>alert("x")</script>`),
        "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
    assert.equal(escapeHtml("a & b"), "a &amp; b");
});

test("parseForm читает поля и чекбоксы", () => {
    const data = parseForm("prefix=1&prefixText=%3F&welcomeOn=1&welcomeMessage=hi+%7Buser%7D");
    assert.equal(data.prefix, "1");
    assert.equal(data.prefixText, "?");
    assert.equal(data.welcomeOn, "1");
    assert.equal(data.welcomeMessage, "hi {user}");
});
