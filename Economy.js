const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

let db;

async function initDatabase() {
    db = await open({
        filename: "./database/database.sqlite",
        driver: sqlite3.Database
    });

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

async function getUser(id) {
    let user = await db.get(
        "SELECT * FROM users WHERE id = ?",
        id
    );

    if (!user) {
        await db.run(
            "INSERT INTO users(id) VALUES(?)",
            id
        );
        user = await db.get(
            "SELECT * FROM users WHERE id = ?",
            id
        );
    }

    return user;
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
    await db.run(
        "UPDATE users SET balance = balance - ? WHERE id = ?",
        amount,
        id
    );
}

async function setBalance(id, amount) {
    await getUser(id);
    await db.run(
        "UPDATE users SET balance=? WHERE id=?",
        amount,
        id
    );
}

module.exports = {
    initDatabase,
    getUser,
    addBalance,
    removeBalance,
    setBalance
};
