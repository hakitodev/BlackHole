const Database = require("better-sqlite3");

let raw = null;

function open(filename) {
    if (raw) {
        close();
    }

    raw = new Database(filename);
    raw.pragma("busy_timeout = 5000");
    raw.pragma("foreign_keys = ON");
    raw.pragma("synchronous = NORMAL");
    try {
        raw.pragma("journal_mode = WAL");
    } catch {
        raw.pragma("journal_mode = DELETE");
    }

    return api();
}

function api() {
    return {
        run(sql, ...params) {
            return raw.prepare(sql).run(...params);
        },
        get(sql, ...params) {
            return raw.prepare(sql).get(...params);
        },
        all(sql, ...params) {
            return raw.prepare(sql).all(...params);
        },
        exec(sql) {
            raw.exec(sql);
        },
        close,
        transaction(work) {
            return raw.transaction(work)();
        }
    };
}

function checkpoint() {
    if (!raw) {
        return;
    }
    try {
        raw.pragma("wal_checkpoint(TRUNCATE)");
    } catch {
        // ignore
    }
}

function close() {
    if (!raw) {
        return;
    }
    checkpoint();
    raw.close();
    raw = null;
}

function native() {
    return raw;
}

module.exports = {
    open,
    close,
    checkpoint,
    native
};
