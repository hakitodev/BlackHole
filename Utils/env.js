const fs = require("fs");
const path = require("path");

function loadEnvFile(filename = path.join(__dirname, "..", ".env")) {
    if (!fs.existsSync(filename)) {
        return;
    }

    for (const raw of fs.readFileSync(filename, "utf8").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) {
            continue;
        }

        const eq = line.indexOf("=");
        if (eq === -1) {
            continue;
        }

        const key = line.slice(0, eq).trim();
        if (!key || process.env[key] !== undefined) {
            continue;
        }

        let value = line.slice(eq + 1).trim();
        if (
            (value.startsWith("\"") && value.endsWith("\"")) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
}

loadEnvFile();

module.exports = {
    loadEnvFile
};
