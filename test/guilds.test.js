const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const economy = require("../Database/Economy");
const { SERVERS, PREFIX } = require("../Config");

let dir;

before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "blackhole-guilds-"));
    await economy.initDatabase(path.join(dir, "guilds.sqlite"));
});

after(async () => {
    await economy.closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
});

test("getGuildSettings: новый сервер с дефолтным префиксом", async () => {
    const settings = await economy.getGuildSettings("999000111222333444");
    assert.equal(settings.prefix, true);
    assert.equal(settings.prefixText, PREFIX);
    assert.equal(settings.welcomeOn, false);
});

test("saveGuildSettings: префикс, канал и тексты", async () => {
    const id = "555666777888999000";
    const saved = await economy.saveGuildSettings(id, {
        prefix: false,
        prefixText: "bh!",
        welcomeOn: true,
        welcomeChannel: "123456789012345678abc",
        welcomeMessage: "Привет, {user}",
        leaveMessage: "Пока, {user}"
    });

    assert.equal(saved.prefix, false);
    assert.equal(saved.prefixText, "bh!");
    assert.equal(saved.welcomeOn, true);
    assert.equal(saved.welcomeChannel, "123456789012345678");
    assert.equal(saved.welcomeMessage, "Привет, {user}");
    assert.equal(saved.leaveMessage, "Пока, {user}");
    assert.equal(await economy.isPrefixEnabled(id), false);
});

test("saveGuildSettings: пустой префикс откатывается к дефолту", async () => {
    const saved = await economy.saveGuildSettings("111222333444555666", {
        prefix: true,
        prefixText: "   ",
        welcomeOn: false
    });
    assert.equal(saved.prefixText, PREFIX);
});

test("servers.json сидирует только при первом создании", async () => {
    const id = Object.keys(SERVERS)[0];
    if (!id) {
        return;
    }

    const first = await economy.getGuildSettings(id);
    assert.equal(first.welcomeOn, true);
    assert.equal(first.welcomeChannel, SERVERS[id].channelId);
    assert.equal(first.welcomeMessage, SERVERS[id].welcomeMessage);

    await economy.saveGuildSettings(id, {
        prefix: true,
        prefixText: PREFIX,
        welcomeOn: false,
        welcomeChannel: "",
        welcomeMessage: "",
        leaveMessage: ""
    });

    const second = await economy.getGuildSettings(id);
    assert.equal(second.welcomeOn, false);
    assert.equal(second.welcomeChannel, "");
    assert.equal(second.welcomeMessage, "");
});

test("saveGuildSettings: частичный апдейт не трёт welcome", async () => {
    const id = "777888999000111222";
    await economy.saveGuildSettings(id, {
        welcomeOn: true,
        welcomeMessage: "жив"
    });
    await economy.saveGuildSettings(id, { prefixText: "bh!" });
    const settings = await economy.getGuildSettings(id);
    assert.equal(settings.prefixText, "bh!");
    assert.equal(settings.welcomeMessage, "жив");
});

test("custom commands: add get delete", async () => {
    const id = "111000222333444555";
    const saved = await economy.saveCustomCommand(id, "Hi!", "Привет, {user}");
    assert.equal(saved.ok, true);
    assert.equal(saved.name, "hi");
    assert.equal((await economy.getCustomCommand(id, "hi")).response, "Привет, {user}");
    assert.equal(await economy.deleteCustomCommand(id, "hi"), true);
    assert.equal(await economy.getCustomCommand(id, "hi"), null);
});
