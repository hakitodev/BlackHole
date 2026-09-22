const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const configPath = path.join(__dirname, "..", "Config.js");

function loadConfig(env) {
    const script = `
        const config = require(${JSON.stringify(configPath)});
        process.stdout.write(JSON.stringify(config));
    `;

    const result = spawnSync(process.execPath, ["-e", script], {
        encoding: "utf8",
        env: {
            ...process.env,
            CLIENT_ID: "",
            OWNER_ID: "",
            PUBLIC_URL: "",
            RENDER_EXTERNAL_URL: "",
            RAILWAY_PUBLIC_DOMAIN: "",
            SERVERS_JSON: "",
            SERVERS_FILE: "",
            ...env
        }
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
}

test("Config: CLIENT_ID и OWNER_ID только из env", () => {
    const config = loadConfig({});

    assert.equal(config.CLIENT_ID, "");
    assert.equal(config.OWNER_ID, "");
});

test("Config: читает SERVERS из файла", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blackhole-config-"));
    const filePath = path.join(dir, "servers.json");

    fs.writeFileSync(filePath, JSON.stringify({
        "111": {
            channelId: "222",
            welcomeMessage: "Привет, {user}",
            leaveMessage: "Прощай, {user}"
        }
    }));

    try {
        const config = loadConfig({ SERVERS_FILE: filePath });
        assert.equal(config.SERVERS["111"].channelId, "222");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("Config: SERVERS_JSON важнее файла", () => {
    const config = loadConfig({
        SERVERS_JSON: JSON.stringify({
            "333": {
                channelId: "444",
                welcomeMessage: "hi",
                leaveMessage: "bye"
            }
        }),
        SERVERS_FILE: "/tmp/does-not-exist.json"
    });

    assert.equal(config.SERVERS["333"].channelId, "444");
});

test("Config: PUBLIC_URL с Render, если сам не задал", () => {
    const config = loadConfig({
        RENDER_EXTERNAL_URL: "https://blackhole.onrender.com/"
    });
    assert.equal(config.PUBLIC_URL, "https://blackhole.onrender.com");
});

test("Config: свой PUBLIC_URL важнее Render", () => {
    const config = loadConfig({
        PUBLIC_URL: "https://bot.example.com",
        RENDER_EXTERNAL_URL: "https://blackhole.onrender.com"
    });
    assert.equal(config.PUBLIC_URL, "https://bot.example.com");
});
