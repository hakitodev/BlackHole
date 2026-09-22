const fs = require("fs");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");

const COOLDOWN_COLUMNS = new Set(["daily", "work", "crime", "rob"]);
const ROOT = path.join(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "economy.sqlite");
const LEGACY_PATH = path.join(__dirname, "database.sqlite");

let db;
let txQueue = Promise.resolve();
let activePath = null;

function neededXp(level) {
    return 100 * Math.max(1, level);
}

function copySidecars(from, to) {
    for (const suffix of ["-wal", "-shm", "-journal"]) {
        const source = from + suffix;
        if (fs.existsSync(source) && !fs.existsSync(to + suffix)) {
            fs.copyFileSync(source, to + suffix);
        }
    }
}

function migrateLegacy(legacyPath, dataPath) {
    try {
        fs.mkdirSync(path.dirname(dataPath), { recursive: true });
        fs.copyFileSync(legacyPath, dataPath);
        copySidecars(legacyPath, dataPath);
        console.log(`База перенесена в ${dataPath}`);
        return dataPath;
    } catch (error) {
        console.warn("Не удалось перенести базу, оставляю старый путь:", error.message);
        return legacyPath;
    }
}

function resolveDatabasePath(filename) {
    if (filename) {
        return path.resolve(filename);
    }

    if (process.env.DATABASE_PATH) {
        return path.resolve(process.env.DATABASE_PATH);
    }

    if (fs.existsSync(DATA_PATH)) {
        return DATA_PATH;
    }

    if (fs.existsSync(LEGACY_PATH)) {
        return migrateLegacy(LEGACY_PATH, DATA_PATH);
    }

    return DATA_PATH;
}

function enqueue(work) {
    const run = txQueue.then(work, work);
    txQueue = run.then(() => {}, () => {});
    return run;
}

async function withTransaction(work) {
    return enqueue(async () => {
        await db.exec("BEGIN IMMEDIATE");
        try {
            const result = await work();
            await db.exec("COMMIT");
            return result;
        } catch (error) {
            await db.exec("ROLLBACK").catch(() => {});
            throw error;
        }
    });
}

async function checkpoint() {
    if (!db) {
        return;
    }

    await db.exec("PRAGMA wal_checkpoint(TRUNCATE);").catch(() => {});
}

async function initDatabase(filename) {
    if (db) {
        await checkpoint();
        await db.close();
        db = null;
    }

    activePath = resolveDatabasePath(filename);
    fs.mkdirSync(path.dirname(activePath), { recursive: true });

    db = await open({
        filename: activePath,
        driver: sqlite3.Database
    });

    await db.exec("PRAGMA busy_timeout = 5000;");
    await db.exec("PRAGMA foreign_keys = ON;");
    await db.exec("PRAGMA synchronous = NORMAL;");

    try {
        await db.exec("PRAGMA journal_mode = WAL;");
    } catch (error) {
        console.warn("WAL недоступен, использую обычный journal:", error.message);
        await db.exec("PRAGMA journal_mode = DELETE;").catch(() => {});
    }

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            balance INTEGER DEFAULT 0,
            bank INTEGER DEFAULT 0,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            daily INTEGER DEFAULT 0,
            work INTEGER DEFAULT 0,
            crime INTEGER DEFAULT 0,
            rob INTEGER DEFAULT 0
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS inventory (
            user_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            qty INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, item_id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS staff (
            user_id TEXT PRIMARY KEY,
            added_by TEXT NOT NULL,
            added_at INTEGER NOT NULL
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS guilds (
            id TEXT PRIMARY KEY,
            prefix INTEGER NOT NULL DEFAULT 1
        );
    `);

    await ensureColumns();
    await checkpoint();

    if (!filename) {
        console.log(`Экономика: ${activePath}`);
    }
}

async function ensureColumns() {
    const columns = await db.all("PRAGMA table_info(users)");
    const names = new Set(columns.map(column => column.name));
    const required = {
        balance: "INTEGER DEFAULT 0",
        bank: "INTEGER DEFAULT 0",
        xp: "INTEGER DEFAULT 0",
        level: "INTEGER DEFAULT 1",
        daily: "INTEGER DEFAULT 0",
        work: "INTEGER DEFAULT 0",
        crime: "INTEGER DEFAULT 0",
        rob: "INTEGER DEFAULT 0"
    };

    for (const [name, definition] of Object.entries(required)) {
        if (!names.has(name)) {
            await db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
        }
    }
}

function asUser(row, id) {
    return {
        id: row?.id ?? id,
        balance: Number(row?.balance) || 0,
        bank: Number(row?.bank) || 0,
        xp: Number(row?.xp) || 0,
        level: Number(row?.level) || 1,
        daily: Number(row?.daily) || 0,
        work: Number(row?.work) || 0,
        crime: Number(row?.crime) || 0,
        rob: Number(row?.rob) || 0
    };
}

async function closeDatabase() {
    if (db) {
        await checkpoint();
        await db.close();
        db = null;
        activePath = null;
    }
}

async function getUser(id) {
    if (!db) {
        throw new Error("База данных ещё не готова");
    }

    const userId = String(id);
    await db.run("INSERT OR IGNORE INTO users(id) VALUES(?)", userId);

    let row = await db.get("SELECT * FROM users WHERE id = ?", userId);

    if (!row) {
        await db.run(
            "INSERT OR REPLACE INTO users(id, balance, bank, xp, level, daily) VALUES(?, 0, 0, 0, 1, 0)",
            userId
        );
        row = await db.get("SELECT * FROM users WHERE id = ?", userId);
    }

    return asUser(row, userId);
}

async function applyLevelUps(id) {
    const user = await db.get("SELECT xp, level FROM users WHERE id = ?", id);
    let xp = Number(user?.xp) || 0;
    let level = Number(user?.level) || 1;
    let leveled = 0;

    while (xp >= neededXp(level) && level < 1000) {
        xp -= neededXp(level);
        level += 1;
        leveled += 1;
    }

    if (leveled) {
        await db.run(
            "UPDATE users SET xp = ?, level = ? WHERE id = ?",
            xp,
            level,
            id
        );
    }

    return { xp, level, leveled };
}

async function addBalance(id, amount) {
    await getUser(id);
    await db.run(
        "UPDATE users SET balance = balance + ? WHERE id = ?",
        amount,
        id
    );
}

async function removeBalance(id, amount) {
    await getUser(id);
    const result = await db.run(
        "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?",
        amount,
        id,
        amount
    );
    return result.changes > 0;
}

async function setBalance(id, amount) {
    await getUser(id);
    await db.run(
        "UPDATE users SET balance = ? WHERE id = ?",
        amount,
        id
    );
}

async function setDaily(id, time) {
    await getUser(id);
    await db.run(
        "UPDATE users SET daily = ? WHERE id = ?",
        time,
        id
    );
}

async function claimTimed(id, column, cooldownMs, payout, xpGain = 0) {
    if (!COOLDOWN_COLUMNS.has(column)) {
        throw new Error("Неизвестная колонка кулдауна");
    }

    await getUser(id);
    const now = Date.now();

    return withTransaction(async () => {
        const result = await db.run(
            `UPDATE users
             SET ${column} = ?, balance = balance + ?, xp = xp + ?
             WHERE id = ? AND (? - ${column} >= ?)`,
            now,
            payout,
            xpGain,
            id,
            now,
            cooldownMs
        );

        if (result.changes === 0) {
            const row = await db.get(`SELECT ${column} AS t FROM users WHERE id = ?`, id);
            return {
                ok: false,
                nextAt: (row?.t ?? 0) + cooldownMs
            };
        }

        const progress = await applyLevelUps(id);
        return { ok: true, amount: payout, xp: xpGain, ...progress };
    });
}

async function claimDaily(id, reward, cooldownMs, xpGain = 25) {
    return claimTimed(id, "daily", cooldownMs, reward, xpGain);
}

async function claimWork(id, payout, cooldownMs, xpGain = 15) {
    return claimTimed(id, "work", cooldownMs, payout, xpGain);
}

async function commitCrime(id, cooldownMs, success, payout, fine, xpGain = 20) {
    await getUser(id);
    const now = Date.now();

    return withTransaction(async () => {
        const ready = await db.run(
            `UPDATE users SET crime = ? WHERE id = ? AND (? - crime >= ?)`,
            now,
            id,
            now,
            cooldownMs
        );

        if (ready.changes === 0) {
            const row = await db.get("SELECT crime AS t FROM users WHERE id = ?", id);
            return { ok: false, nextAt: (row?.t ?? 0) + cooldownMs };
        }

        if (success) {
            await db.run(
                "UPDATE users SET balance = balance + ?, xp = xp + ? WHERE id = ?",
                payout,
                xpGain,
                id
            );
            const progress = await applyLevelUps(id);
            return { ok: true, success: true, amount: payout, xp: xpGain, ...progress };
        }

        const paid = await db.run(
            "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?",
            fine,
            id,
            fine
        );

        if (!paid.changes) {
            await db.run("UPDATE users SET balance = 0 WHERE id = ?", id);
            return { ok: true, success: false, amount: 0, wiped: true };
        }

        return { ok: true, success: false, amount: fine, wiped: false };
    });
}

async function attemptRob(fromId, toId, cooldownMs, success, steal, fine) {
    await getUser(fromId);
    await getUser(toId);
    const now = Date.now();

    return withTransaction(async () => {
        const target = await db.get("SELECT balance FROM users WHERE id = ?", toId);
        const cash = Number(target?.balance) || 0;

        if (cash < 50) {
            return { ok: false, reason: "empty" };
        }

        const ready = await db.run(
            `UPDATE users SET rob = ? WHERE id = ? AND (? - rob >= ?)`,
            now,
            fromId,
            now,
            cooldownMs
        );

        if (ready.changes === 0) {
            const row = await db.get("SELECT rob AS t FROM users WHERE id = ?", fromId);
            return { ok: false, reason: "cooldown", nextAt: (row?.t ?? 0) + cooldownMs };
        }

        if (!success) {
            const paid = await db.run(
                "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?",
                fine,
                fromId,
                fine
            );

            if (!paid.changes) {
                await db.run("UPDATE users SET balance = 0 WHERE id = ?", fromId);
                return { ok: true, success: false, amount: 0, wiped: true };
            }

            await db.run(
                "UPDATE users SET balance = balance + ? WHERE id = ?",
                fine,
                toId
            );
            return { ok: true, success: false, amount: fine, wiped: false };
        }

        const amount = Math.min(steal, cash);
        const stolen = await db.run(
            "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?",
            amount,
            toId,
            amount
        );

        if (!stolen.changes) {
            return { ok: false, reason: "empty" };
        }

        await db.run(
            "UPDATE users SET balance = balance + ?, xp = xp + ? WHERE id = ?",
            amount,
            20,
            fromId
        );
        const progress = await applyLevelUps(fromId);
        return { ok: true, success: true, amount, ...progress };
    });
}

async function flipBet(id, amount, win) {
    await getUser(id);

    return withTransaction(async () => {
        const spent = await db.run(
            "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?",
            amount,
            id,
            amount
        );

        if (spent.changes === 0) {
            return { ok: false, reason: "insufficient" };
        }

        if (win) {
            await db.run(
                "UPDATE users SET balance = balance + ? WHERE id = ?",
                amount * 2,
                id
            );
        }

        return { ok: true, win, amount };
    });
}

async function transfer(fromId, toId, amount) {
    await getUser(fromId);
    await getUser(toId);

    return withTransaction(async () => {
        const spent = await db.run(
            "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?",
            amount,
            fromId,
            amount
        );

        if (spent.changes === 0) {
            return { ok: false, reason: "insufficient" };
        }

        await db.run(
            "UPDATE users SET balance = balance + ? WHERE id = ?",
            amount,
            toId
        );

        return { ok: true };
    });
}

async function getTop(limit = 10, type = "money", offset = 0) {
    const safeLimit = Math.max(1, Math.min(25, Number(limit) || 10));
    const safeOffset = Math.max(0, Number(offset) || 0);

    if (type === "level") {
        return db.all(
            "SELECT * FROM users ORDER BY level DESC, xp DESC LIMIT ? OFFSET ?",
            safeLimit,
            safeOffset
        );
    }

    return db.all(
        "SELECT * FROM users ORDER BY (balance + bank) DESC, balance DESC LIMIT ? OFFSET ?",
        safeLimit,
        safeOffset
    );
}

async function countUsers() {
    const row = await db.get("SELECT COUNT(*) AS n FROM users");
    return Number(row?.n) || 0;
}

async function deposit(id, amount) {
    await getUser(id);

    return withTransaction(async () => {
        const result = await db.run(
            `UPDATE users
             SET balance = balance - ?, bank = bank + ?
             WHERE id = ? AND balance >= ?`,
            amount,
            amount,
            id,
            amount
        );
        return { ok: result.changes > 0 };
    });
}

async function withdraw(id, amount) {
    await getUser(id);

    return withTransaction(async () => {
        const result = await db.run(
            `UPDATE users
             SET balance = balance + ?, bank = bank - ?
             WHERE id = ? AND bank >= ?`,
            amount,
            amount,
            id,
            amount
        );
        return { ok: result.changes > 0 };
    });
}

async function getInventory(id) {
    await getUser(id);
    return db.all(
        "SELECT item_id, qty FROM inventory WHERE user_id = ? AND qty > 0 ORDER BY qty DESC",
        String(id)
    );
}

async function buyItem(id, itemId, price, qty) {
    const cost = price * qty;
    await getUser(id);

    return withTransaction(async () => {
        const spent = await db.run(
            "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?",
            cost,
            id,
            cost
        );

        if (spent.changes === 0) {
            return { ok: false, reason: "insufficient" };
        }

        await db.run(
            `INSERT INTO inventory(user_id, item_id, qty) VALUES(?, ?, ?)
             ON CONFLICT(user_id, item_id) DO UPDATE SET qty = qty + excluded.qty`,
            String(id),
            itemId,
            qty
        );

        return { ok: true, cost };
    });
}

async function takeBalance(id, amount) {
    await getUser(id);

    return withTransaction(async () => {
        const row = await db.get(
            "SELECT balance, bank FROM users WHERE id = ?",
            id
        );
        const cash = Number(row?.balance) || 0;
        const bank = Number(row?.bank) || 0;
        const total = cash + bank;

        if (total < amount) {
            return { ok: false, total };
        }

        const fromCash = Math.min(amount, cash);
        const fromBank = amount - fromCash;

        await db.run(
            "UPDATE users SET balance = balance - ?, bank = bank - ? WHERE id = ?",
            fromCash,
            fromBank,
            id
        );

        return { ok: true, amount, fromCash, fromBank };
    });
}

async function isStaff(id) {
    const row = await db.get(
        "SELECT user_id FROM staff WHERE user_id = ?",
        String(id)
    );
    return Boolean(row);
}

async function addStaff(id, addedBy) {
    const userId = String(id);
    const result = await db.run(
        `INSERT OR IGNORE INTO staff(user_id, added_by, added_at)
         VALUES(?, ?, ?)`,
        userId,
        String(addedBy),
        Date.now()
    );
    return result.changes > 0;
}

async function removeStaff(id) {
    const result = await db.run(
        "DELETE FROM staff WHERE user_id = ?",
        String(id)
    );
    return result.changes > 0;
}

async function listStaff() {
    return db.all("SELECT user_id, added_by, added_at FROM staff ORDER BY added_at ASC");
}

async function isPrefixEnabled(guildId) {
    if (!guildId) {
        return true;
    }

    const row = await db.get(
        "SELECT prefix FROM guilds WHERE id = ?",
        String(guildId)
    );

    if (!row) {
        return true;
    }

    return Number(row.prefix) !== 0;
}

async function setPrefixEnabled(guildId, enabled) {
    await db.run(
        `INSERT INTO guilds(id, prefix) VALUES(?, ?)
         ON CONFLICT(id) DO UPDATE SET prefix = excluded.prefix`,
        String(guildId),
        enabled ? 1 : 0
    );
}

module.exports = {
    initDatabase,
    closeDatabase,
    resolveDatabasePath,
    getUser,
    addBalance,
    removeBalance,
    setBalance,
    setDaily,
    claimDaily,
    claimWork,
    commitCrime,
    attemptRob,
    flipBet,
    transfer,
    getTop,
    countUsers,
    deposit,
    withdraw,
    getInventory,
    buyItem,
    takeBalance,
    isStaff,
    addStaff,
    removeStaff,
    listStaff,
    isPrefixEnabled,
    setPrefixEnabled,
    neededXp
};
