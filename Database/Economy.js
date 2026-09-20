const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");

let db;

async function withTransaction(work) {
    await db.exec("BEGIN IMMEDIATE");
    try {
        const result = await work();
        await db.exec("COMMIT");
        return result;
    } catch (error) {
        await db.exec("ROLLBACK").catch(() => {});
        throw error;
    }
}

async function initDatabase() {
    db = await open({
        filename: path.join(__dirname, "database.sqlite"),
        driver: sqlite3.Database
    });

    await db.exec("PRAGMA journal_mode = WAL;");
    await db.exec("PRAGMA busy_timeout = 5000;");
    await db.exec("PRAGMA foreign_keys = ON;");

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            balance INTEGER DEFAULT 0,
            bank INTEGER DEFAULT 0,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            daily INTEGER DEFAULT 0
        );
    `);
}

async function closeDatabase() {
    if (db) {
        await db.close();
        db = null;
    }
}

async function getUser(id) {
    await db.run("INSERT OR IGNORE INTO users(id) VALUES(?)", id);
    return db.get("SELECT * FROM users WHERE id = ?", id);
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

async function claimDaily(id, reward, cooldownMs) {
    await getUser(id);
    const now = Date.now();

    return withTransaction(async () => {
        const result = await db.run(
            `UPDATE users
             SET balance = balance + ?, daily = ?
             WHERE id = ? AND (? - daily >= ?)`,
            reward,
            now,
            id,
            now,
            cooldownMs
        );

        if (result.changes === 0) {
            const user = await db.get("SELECT daily FROM users WHERE id = ?", id);
            return {
                ok: false,
                nextAt: (user?.daily ?? 0) + cooldownMs
            };
        }

        return { ok: true, amount: reward };
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

async function getTop(limit = 10) {
    return db.all(
        "SELECT * FROM users ORDER BY (balance + bank) DESC, balance DESC LIMIT ?",
        limit
    );
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

module.exports = {
    initDatabase,
    closeDatabase,
    getUser,
    addBalance,
    removeBalance,
    setBalance,
    setDaily,
    claimDaily,
    transfer,
    getTop,
    deposit,
    withdraw
};
