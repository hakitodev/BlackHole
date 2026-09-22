const { test } = require("node:test");
const assert = require("node:assert/strict");
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

test("Config: нет SERVERS и не читает servers.json", () => {
    const config = loadConfig({});
    assert.equal(config.SERVERS, undefined);
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

test("Config: обрезает случайный /oauth/callback в PUBLIC_URL", () => {
    const config = loadConfig({
        PUBLIC_URL: "https://blackhole-d7h5.onrender.com/oauth/callback/"
    });
    assert.equal(config.PUBLIC_URL, "https://blackhole-d7h5.onrender.com");
});
