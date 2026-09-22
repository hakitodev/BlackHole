const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const economy = require("../Database/Economy");

let dir;

after(async () => {
    await economy.closeDatabase();
    if (dir) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("initDatabase создаёт папку и не затирает баланс после переоткрытия", async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "blackhole-persist-"));
    const file = path.join(dir, "nested", "economy.sqlite");

    await economy.initDatabase(file);
    await economy.addBalance("persist-1", 777);
    await economy.closeDatabase();

    assert.equal(fs.existsSync(file), true);

    await economy.initDatabase(file);
    const user = await economy.getUser("persist-1");
    assert.equal(user.balance, 777);
});
