const fs = require("fs");
const path = require("path");
const engine = require("./engine");
const { PREFIX } = require("../Config");
const { parseIdList, snowflake } = require("../Utils/ids");
const { parseWords } = require("../Utils/automod");
const { moneyInt, FLIP_MAX_BET, ROB_MAX_STEAL, clampGuildCap, JOB_IDLE_MS, BIZ_IDLE_MS } = require("../Utils/limits");
const { GLOBAL_SCOPE, normScope, isGuildScope } = require("../Utils/scope");
const { asDrop, dropExtra, roll, getBox } = require("../Utils/boxes");
const { isHexColor } = require("../Utils/color");
const { JOBS } = require("../Utils/jobs");
const settingsCache = require("../Utils/settingsCache");

const COOLDOWN_COLUMNS = new Set(["daily", "work", "crime", "rob"]);
const ROOT = path.join(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "economy.sqlite");
const LEGACY_PATH = path.join(__dirname, "database.sqlite");

let db;
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

function withTransaction(work) {
    if (!db) {
        throw new Error("База данных ещё не готова");
    }
    return db.transaction(work);
}

function checkpoint() {
    engine.checkpoint();
}

async function initDatabase(filename) {
    settingsCache.clear();
    if (db) {
        checkpoint();
        db.close();
        db = null;
    }

    activePath = resolveDatabasePath(filename);
    fs.mkdirSync(path.dirname(activePath), { recursive: true });

    db = engine.open(activePath);

    db.exec(`
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

    db.exec(`
        CREATE TABLE IF NOT EXISTS inventory (
            user_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            qty INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, item_id)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS staff (
            user_id TEXT PRIMARY KEY,
            added_by TEXT NOT NULL,
            added_at INTEGER NOT NULL
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS guilds (
            id TEXT PRIMARY KEY,
            prefix INTEGER NOT NULL DEFAULT 1
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS custom_commands (
            guild_id TEXT NOT NULL,
            name TEXT NOT NULL,
            response TEXT NOT NULL,
            PRIMARY KEY (guild_id, name)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS web_sessions (
            id TEXT PRIMARY KEY,
            user_json TEXT NOT NULL,
            guilds_json TEXT NOT NULL,
            access_token TEXT,
            refresh_token TEXT,
            expires_at INTEGER,
            created_at INTEGER NOT NULL,
            last_seen INTEGER NOT NULL
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS guild_events (
            guild_id TEXT NOT NULL,
            name TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 0,
            channel TEXT,
            message TEXT,
            PRIMARY KEY (guild_id, name)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS shop_items (
            scope TEXT NOT NULL,
            id TEXT NOT NULL,
            name TEXT NOT NULL,
            emoji TEXT NOT NULL DEFAULT '',
            price INTEGER NOT NULL DEFAULT 0,
            description TEXT NOT NULL DEFAULT '',
            PRIMARY KEY (scope, id)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS kv (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS businesses (
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            level INTEGER NOT NULL DEFAULT 1,
            unclaimed INTEGER NOT NULL DEFAULT 0,
            last_tick INTEGER NOT NULL DEFAULT 0,
            last_revenue_collect INTEGER NOT NULL DEFAULT 0,
            stalled INTEGER NOT NULL DEFAULT 0,
            boost INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, type)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS guild_wallets (
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            balance INTEGER DEFAULT 0,
            bank INTEGER DEFAULT 0,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            daily INTEGER DEFAULT 0,
            work INTEGER DEFAULT 0,
            crime INTEGER DEFAULT 0,
            rob INTEGER DEFAULT 0,
            username TEXT NOT NULL DEFAULT '',
            avatar TEXT NOT NULL DEFAULT '',
            btc INTEGER NOT NULL DEFAULT 0,
            job TEXT NOT NULL DEFAULT '',
            last_work INTEGER NOT NULL DEFAULT 0,
            last_active INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (guild_id, user_id)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS guild_inventory (
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            qty INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (guild_id, user_id, item_id)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS guild_businesses (
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            level INTEGER NOT NULL DEFAULT 1,
            unclaimed INTEGER NOT NULL DEFAULT 0,
            last_tick INTEGER NOT NULL DEFAULT 0,
            last_revenue_collect INTEGER NOT NULL DEFAULT 0,
            stalled INTEGER NOT NULL DEFAULT 0,
            boost INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (guild_id, user_id, type)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS guild_staff (
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            rank INTEGER NOT NULL DEFAULT 1,
            added_by TEXT NOT NULL,
            added_at INTEGER NOT NULL,
            PRIMARY KEY (guild_id, user_id)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS catalogs (
            scope TEXT NOT NULL,
            kind TEXT NOT NULL,
            id TEXT NOT NULL,
            name TEXT NOT NULL,
            extra TEXT NOT NULL DEFAULT '{}',
            PRIMARY KEY (scope, kind, id)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS boxes (
            scope TEXT NOT NULL,
            id TEXT NOT NULL,
            name TEXT NOT NULL,
            emoji TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            PRIMARY KEY (scope, id)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS box_drops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT NOT NULL,
            box_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            weight INTEGER NOT NULL DEFAULT 1,
            extra TEXT NOT NULL DEFAULT '{}'
        );
    `);

    await ensureColumns();
    await ensureGuildColumns();
    await ensureStaffColumns();
    await ensureCustomCommandColumns();
    await ensureShopColumns();
    await ensureBusinessColumns();
    await migrateIndexes();
    await seedGlobalShop();
    await seedDefaultBoxes();
    warmGuildCache();
    checkpoint();

    if (!filename) {
        console.log(`Экономика: ${activePath}`);
    }
}

async function ensureColumns() {
    const columns = db.all("PRAGMA table_info(users)");
    const names = new Set(columns.map(column => column.name));
    const required = {
        balance: "INTEGER DEFAULT 0",
        bank: "INTEGER DEFAULT 0",
        xp: "INTEGER DEFAULT 0",
        level: "INTEGER DEFAULT 1",
        daily: "INTEGER DEFAULT 0",
        work: "INTEGER DEFAULT 0",
        crime: "INTEGER DEFAULT 0",
        rob: "INTEGER DEFAULT 0",
        username: "TEXT NOT NULL DEFAULT ''",
        avatar: "TEXT NOT NULL DEFAULT ''",
        btc: "INTEGER NOT NULL DEFAULT 0",
        job: "TEXT NOT NULL DEFAULT ''",
        last_work: "INTEGER NOT NULL DEFAULT 0",
        last_active: "INTEGER NOT NULL DEFAULT 0"
    };

    for (const [name, definition] of Object.entries(required)) {
        if (!names.has(name)) {
            db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
        }
    }
}

async function ensureGuildColumns() {
    const columns = db.all("PRAGMA table_info(guilds)");
    const names = new Set(columns.map(column => column.name));
    const required = {
        prefix: "INTEGER NOT NULL DEFAULT 1",
        prefix_text: "TEXT NOT NULL DEFAULT '!'",
        welcome_on: "INTEGER NOT NULL DEFAULT 0",
        welcome_channel: "TEXT",
        welcome_message: "TEXT",
        leave_message: "TEXT",
        autorole_ids: "TEXT",
        log_channel: "TEXT",
        log_joins: "INTEGER NOT NULL DEFAULT 0",
        log_messages: "INTEGER NOT NULL DEFAULT 0",
        log_mod: "INTEGER NOT NULL DEFAULT 0",
        levels_on: "INTEGER NOT NULL DEFAULT 0",
        levels_channel: "TEXT",
        levels_message: "TEXT",
        automod_invites: "INTEGER NOT NULL DEFAULT 0",
        automod_words: "TEXT",
        automod_links: "INTEGER NOT NULL DEFAULT 0",
        automod_spam: "INTEGER NOT NULL DEFAULT 0",
        automod_swear: "INTEGER NOT NULL DEFAULT 0",
        automod_caps: "INTEGER NOT NULL DEFAULT 0",
        automod_fine_links: "INTEGER NOT NULL DEFAULT 0",
        automod_fine_spam: "INTEGER NOT NULL DEFAULT 0",
        automod_fine_swear: "INTEGER NOT NULL DEFAULT 0",
        automod_fine_caps: "INTEGER NOT NULL DEFAULT 0",
        disabled_commands: "TEXT",
        xp_on: "INTEGER NOT NULL DEFAULT 1",
        level_money: "INTEGER NOT NULL DEFAULT 250",
        daily_min: "INTEGER NOT NULL DEFAULT 300",
        daily_max: "INTEGER NOT NULL DEFAULT 1100",
        work_min: "INTEGER NOT NULL DEFAULT 70",
        work_max: "INTEGER NOT NULL DEFAULT 260",
        crime_min: "INTEGER NOT NULL DEFAULT 180",
        crime_max: "INTEGER NOT NULL DEFAULT 480",
        crime_fine_min: "INTEGER NOT NULL DEFAULT 80",
        crime_fine_max: "INTEGER NOT NULL DEFAULT 220",
        wallet_scope: "TEXT NOT NULL DEFAULT 'global'",
        jobs_global: "INTEGER NOT NULL DEFAULT 1",
        jobs_guild: "INTEGER NOT NULL DEFAULT 0",
        biz_global: "INTEGER NOT NULL DEFAULT 1",
        biz_guild: "INTEGER NOT NULL DEFAULT 0",
        shop_global: "INTEGER NOT NULL DEFAULT 1",
        shop_guild: "INTEGER NOT NULL DEFAULT 1",
        earn_on: "INTEGER NOT NULL DEFAULT 1",
        economy_on: "INTEGER NOT NULL DEFAULT 1",
        penalties_on: "INTEGER NOT NULL DEFAULT 1",
        paused: "INTEGER NOT NULL DEFAULT 0",
        flip_max: "INTEGER NOT NULL DEFAULT 25000",
        rob_max: "INTEGER NOT NULL DEFAULT 15000"
    };

    const hadLinks = names.has("automod_links");
    const hadSwear = names.has("automod_swear");

    for (const [name, definition] of Object.entries(required)) {
        if (!names.has(name)) {
            db.exec(`ALTER TABLE guilds ADD COLUMN ${name} ${definition}`);
        }
    }

    if (!hadLinks) {
        db.exec("UPDATE guilds SET automod_links = automod_invites");
    }
    if (!hadSwear) {
        db.exec("UPDATE guilds SET automod_swear = 1 WHERE TRIM(IFNULL(automod_words, '')) != ''");
    }
}

async function ensureStaffColumns() {
    const columns = db.all("PRAGMA table_info(staff)");
    const names = new Set(columns.map(column => column.name));
    if (!names.has("rank")) {
        db.exec("ALTER TABLE staff ADD COLUMN rank INTEGER NOT NULL DEFAULT 1");
    }
}

async function ensureShopColumns() {
    const columns = db.all("PRAGMA table_info(shop_items)");
    const names = new Set(columns.map(column => column.name));
    if (!names.has("kind")) {
        db.exec("ALTER TABLE shop_items ADD COLUMN kind TEXT NOT NULL DEFAULT 'item'");
    }
    if (!names.has("extra")) {
        db.exec("ALTER TABLE shop_items ADD COLUMN extra TEXT NOT NULL DEFAULT ''");
    }
}

async function ensureBusinessColumns() {
    const columns = db.all("PRAGMA table_info(businesses)");
    const names = new Set(columns.map(column => column.name));
    if (!names.has("last_revenue_collect")) {
        db.exec("ALTER TABLE businesses ADD COLUMN last_revenue_collect INTEGER NOT NULL DEFAULT 0");
        db.exec("UPDATE businesses SET last_revenue_collect = last_tick WHERE last_revenue_collect = 0");
    }
    if (!names.has("stalled")) {
        db.exec("ALTER TABLE businesses ADD COLUMN stalled INTEGER NOT NULL DEFAULT 0");
    }
    if (!names.has("boost")) {
        db.exec("ALTER TABLE businesses ADD COLUMN boost INTEGER NOT NULL DEFAULT 0");
    }
    const guildCols = db.all("PRAGMA table_info(guild_businesses)");
    const guildNames = new Set(guildCols.map(column => column.name));
    if (guildNames.size && !guildNames.has("last_revenue_collect")) {
        db.exec("ALTER TABLE guild_businesses ADD COLUMN last_revenue_collect INTEGER NOT NULL DEFAULT 0");
        db.exec("UPDATE guild_businesses SET last_revenue_collect = last_tick WHERE last_revenue_collect = 0");
    }
    if (guildNames.size && !guildNames.has("stalled")) {
        db.exec("ALTER TABLE guild_businesses ADD COLUMN stalled INTEGER NOT NULL DEFAULT 0");
    }
    if (guildNames.size && !guildNames.has("boost")) {
        db.exec("ALTER TABLE guild_businesses ADD COLUMN boost INTEGER NOT NULL DEFAULT 0");
    }
}

async function migrateIndexes() {
    db.exec("CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_businesses_user ON businesses(user_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_guild_wallets_user ON guild_wallets(user_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_guild_wallets_guild ON guild_wallets(guild_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_guild_inv_user ON guild_inventory(user_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_guild_inv_guild ON guild_inventory(guild_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_guild_biz_user ON guild_businesses(user_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_guild_biz_guild ON guild_businesses(guild_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_guild_staff_guild ON guild_staff(guild_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_guild_staff_user ON guild_staff(user_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_shop_scope ON shop_items(scope);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_catalogs_scope ON catalogs(scope, kind);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_boxes_scope ON boxes(scope);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_box_drops_box ON box_drops(scope, box_id);");
}

async function ensureCustomCommandColumns() {
    const columns = db.all("PRAGMA table_info(custom_commands)");
    const names = new Set(columns.map(column => column.name));
    const required = {
        title: "TEXT",
        color: "TEXT",
        image: "TEXT",
        thumbnail: "TEXT",
        footer: "TEXT",
        content: "TEXT",
        author: "TEXT",
        author_icon: "TEXT",
        url: "TEXT",
        footer_icon: "TEXT",
        fields: "TEXT",
        timestamp: "INTEGER NOT NULL DEFAULT 0"
    };
    for (const [name, definition] of Object.entries(required)) {
        if (!names.has(name)) {
            db.exec(`ALTER TABLE custom_commands ADD COLUMN ${name} ${definition}`);
        }
    }
}

const DEFAULT_SHOP = [
    ["coffee", "Кофе", "☕", 80, "Маленький буст настроения"],
    ["pizza", "Пицца", "🍕", 250, "На всю компанию"],
    ["phone", "Телефон", "📱", 3500, "Чтобы писать ещё чаще"],
    ["laptop", "Ноутбук", "💻", 8000, "Для серьёзной работы"],
    ["car", "Машина", "🚗", 35000, "Уже не пешком"],
    ["house", "Дом", "🏠", 120000, "Свой угол"],
    ["yacht", "Яхта", "🛥️", 500000, "Если совсем некуда деньги девать"],
    ["box_wood", "Деревянный бокс", "📦", 400, "Случайные монеты"],
    ["box_iron", "Железный бокс", "🧰", 2500, "Пожирнее"],
    ["box_gold", "Золотой бокс", "🎁", 15000, "Жирный лут"]
];

async function seedGlobalShop() {
    const row = db.get("SELECT COUNT(*) AS n FROM shop_items WHERE scope = 'global'");
    const seed = Number(row?.n) > 0 ? DEFAULT_SHOP.filter(item => String(item[0]).startsWith("box_")) : DEFAULT_SHOP;

    for (const [id, name, emoji, price, description] of seed) {
        db.run(
            "INSERT OR IGNORE INTO shop_items(scope, id, name, emoji, price, description) VALUES('global', ?, ?, ?, ?, ?)",
            id,
            name,
            emoji,
            price,
            description
        );
    }
}

async function seedDefaultBoxes() {
    const { BOXES, dropExtra } = require("../Utils/boxes");
    const row = db.get("SELECT COUNT(*) AS n FROM boxes WHERE scope = 'global'");
    if (Number(row?.n) > 0) {
        return;
    }
    for (const box of BOXES) {
        db.run(
            "INSERT OR IGNORE INTO boxes(scope, id, name, emoji, description) VALUES('global', ?, ?, ?, ?)",
            box.id,
            box.name,
            box.emoji,
            box.description || ""
        );
        for (const drop of box.drops || []) {
            db.run(
                "INSERT INTO box_drops(scope, box_id, kind, weight, extra) VALUES('global', ?, ?, ?, ?)",
                box.id,
                drop.kind,
                Math.max(1, moneyInt(drop.weight, 1) || 1),
                JSON.stringify(dropExtra(drop))
            );
        }
    }
}

function walletRef(scope, id) {
    const sid = normScope(scope);
    const userId = String(id);
    if (isGuildScope(sid)) {
        return {
            sid,
            userId,
            table: "guild_wallets",
            where: "guild_id = ? AND user_id = ?",
            keys: [sid, userId]
        };
    }
    return {
        sid: GLOBAL_SCOPE,
        userId,
        table: "users",
        where: "id = ?",
        keys: [userId]
    };
}

function bizRef(scope, userId, type) {
    const sid = normScope(scope);
    const id = String(userId);
    const kind = String(type || "");
    if (isGuildScope(sid)) {
        return {
            table: "guild_businesses",
            where: "guild_id = ? AND user_id = ? AND type = ?",
            keys: [sid, id, kind],
            listWhere: "guild_id = ? AND user_id = ?",
            listKeys: [sid, id],
            insert: "INSERT INTO guild_businesses(guild_id, user_id, type, level, unclaimed, last_tick, last_revenue_collect, stalled, boost) VALUES(?, ?, ?, 1, 0, ?, ?, 0, 0)",
            insertKeys: (now) => [sid, id, kind, now, now]
        };
    }
    return {
        table: "businesses",
        where: "user_id = ? AND type = ?",
        keys: [id, kind],
        listWhere: "user_id = ?",
        listKeys: [id],
        insert: "INSERT INTO businesses(user_id, type, level, unclaimed, last_tick, last_revenue_collect, stalled, boost) VALUES(?, ?, 1, 0, ?, ?, 0, 0)",
        insertKeys: (now) => [id, kind, now, now]
    };
}

function asUser(row, id, scope = GLOBAL_SCOPE) {
    return {
        id: row?.user_id ?? row?.id ?? id,
        scope,
        balance: Number(row?.balance) || 0,
        bank: Number(row?.bank) || 0,
        xp: Number(row?.xp) || 0,
        level: Number(row?.level) || 1,
        daily: Number(row?.daily) || 0,
        work: Number(row?.work) || 0,
        crime: Number(row?.crime) || 0,
        rob: Number(row?.rob) || 0,
        username: row?.username || "",
        avatar: row?.avatar || "",
        btc: Number(row?.btc) || 0,
        job: row?.job || "",
        lastWork: Number(row?.last_work) || 0,
        lastActive: Number(row?.last_active) || 0
    };
}

function getUser(id, scope = GLOBAL_SCOPE) {
    if (!db) {
        throw new Error("База данных ещё не готова");
    }

    const userId = String(id);
    const sid = normScope(scope);

    if (!isGuildScope(sid)) {
        db.run("INSERT OR IGNORE INTO users(id) VALUES(?)", userId);
        let row = db.get("SELECT * FROM users WHERE id = ?", userId);
        if (!row) {
            db.run(
                "INSERT OR REPLACE INTO users(id, balance, bank, xp, level, daily) VALUES(?, 0, 0, 0, 1, 0)",
                userId
            );
            row = db.get("SELECT * FROM users WHERE id = ?", userId);
        }
        return asUser(row, userId, GLOBAL_SCOPE);
    }

    db.run(
        "INSERT OR IGNORE INTO guild_wallets(guild_id, user_id) VALUES(?, ?)",
        sid,
        userId
    );
    const row = db.get(
        "SELECT * FROM guild_wallets WHERE guild_id = ? AND user_id = ?",
        sid,
        userId
    );
    return asUser(row, userId, sid);
}

async function closeDatabase() {
    settingsCache.clear();
    if (db) {
        checkpoint();
        db.close();
        db = null;
        activePath = null;
    }
}

function applyLevelUps(id, moneyPerLevel = 250, scope = GLOBAL_SCOPE) {
    const sid = normScope(scope);
    const user = isGuildScope(sid)
        ? db.get("SELECT xp, level FROM guild_wallets WHERE guild_id = ? AND user_id = ?", sid, id)
        : db.get("SELECT xp, level FROM users WHERE id = ?", id);
    let xp = Number(user?.xp) || 0;
    let level = Number(user?.level) || 1;
    let leveled = 0;
    const payout = Math.max(0, moneyInt(moneyPerLevel, 0));

    while (xp >= neededXp(level) && level < 10000) {
        xp -= neededXp(level);
        level += 1;
        leveled += 1;
    }

    if (leveled) {
        const money = payout * leveled;
        if (isGuildScope(sid)) {
            db.run(
                "UPDATE guild_wallets SET xp = ?, level = ?, balance = balance + ? WHERE guild_id = ? AND user_id = ?",
                xp,
                level,
                money,
                sid,
                id
            );
        } else {
            db.run(
                "UPDATE users SET xp = ?, level = ?, balance = balance + ? WHERE id = ?",
                xp,
                level,
                money,
                id
            );
        }
        return { xp, level, leveled, money };
    }

    return { xp, level, leveled: 0, money: 0 };
}

async function addXp(id, amount, moneyPerLevel = 250, scope = GLOBAL_SCOPE) {
    const gain = moneyInt(amount);
    getUser(id, scope);
    const sid = normScope(scope);
    if (isGuildScope(sid)) {
        db.run(
            "UPDATE guild_wallets SET xp = xp + ? WHERE guild_id = ? AND user_id = ?",
            gain,
            sid,
            id
        );
    } else {
        db.run("UPDATE users SET xp = xp + ? WHERE id = ?", gain, id);
    }
    return applyLevelUps(id, moneyPerLevel, scope);
}

async function addXpBatch(entries) {
    const results = [];
    if (!entries?.length) {
        return results;
    }
    return withTransaction(() => {
        for (const entry of entries) {
            const progress = addXp(
                entry.userId,
                entry.xp,
                entry.moneyPerLevel,
                entry.scope || GLOBAL_SCOPE
            );
            results.push({ ...entry, progress });
        }
        return results;
    });
}

async function addBalance(id, amount, scope = GLOBAL_SCOPE) {
    const delta = moneyInt(amount);
    getUser(id, scope);
    const sid = normScope(scope);
    if (isGuildScope(sid)) {
        db.run(
            "UPDATE guild_wallets SET balance = balance + ? WHERE guild_id = ? AND user_id = ?",
            delta,
            sid,
            String(id)
        );
    } else {
        db.run(
            "UPDATE users SET balance = balance + ? WHERE id = ?",
            delta,
            id
        );
    }
}

function cashSpend(id, amount, scope = GLOBAL_SCOPE) {
    const bet = moneyInt(amount);
    const sid = normScope(scope);
    if (isGuildScope(sid)) {
        return db.run(
            "UPDATE guild_wallets SET balance = balance - ? WHERE guild_id = ? AND user_id = ? AND balance >= ?",
            bet,
            sid,
            String(id),
            bet
        );
    }
    return db.run(
        "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?",
        bet,
        id,
        bet
    );
}

function cashAdd(id, amount, scope = GLOBAL_SCOPE) {
    const bet = moneyInt(amount);
    const sid = normScope(scope);
    if (isGuildScope(sid)) {
        return db.run(
            "UPDATE guild_wallets SET balance = balance + ? WHERE guild_id = ? AND user_id = ?",
            bet,
            sid,
            String(id)
        );
    }
    return db.run(
        "UPDATE users SET balance = balance + ? WHERE id = ?",
        bet,
        id
    );
}

async function removeBalance(id, amount, scope = GLOBAL_SCOPE) {
    getUser(id, scope);
    const result = cashSpend(id, amount, scope);
    return result.changes > 0;
}

async function setBalance(id, amount, scope = GLOBAL_SCOPE) {
    const value = moneyInt(amount);
    getUser(id, scope);
    const sid = normScope(scope);
    if (isGuildScope(sid)) {
        db.run(
            "UPDATE guild_wallets SET balance = ? WHERE guild_id = ? AND user_id = ?",
            value,
            sid,
            String(id)
        );
        return;
    }
    db.run(
        "UPDATE users SET balance = ? WHERE id = ?",
        value,
        id
    );
}

async function setDaily(id, time, scope = GLOBAL_SCOPE) {
    getUser(id, scope);
    const w = walletRef(scope, id);
    db.run(
        `UPDATE ${w.table} SET daily = ? WHERE ${w.where}`,
        time,
        ...w.keys
    );
}

async function claimTimed(id, column, cooldownMs, payout, xpGain = 0, scope = GLOBAL_SCOPE) {
    if (!COOLDOWN_COLUMNS.has(column)) {
        throw new Error("Неизвестная колонка кулдауна");
    }

    getUser(id, scope);
    const now = Date.now();
    const w = walletRef(scope, id);
    const extra = column === "work"
        ? ", last_work = ?, last_active = ?"
        : ", last_active = ?";
    const extraParams = column === "work" ? [now, now] : [now];

    return withTransaction(() => {
        const result = db.run(
            `UPDATE ${w.table}
             SET ${column} = ?, balance = balance + ?, xp = xp + ?${extra}
             WHERE ${w.where} AND (? - ${column} >= ?)`,
            now,
            moneyInt(payout),
            moneyInt(xpGain),
            ...extraParams,
            ...w.keys,
            now,
            cooldownMs
        );

        if (result.changes === 0) {
            const row = db.get(
                `SELECT ${column} AS t FROM ${w.table} WHERE ${w.where}`,
                ...w.keys
            );
            return {
                ok: false,
                nextAt: (row?.t ?? 0) + cooldownMs
            };
        }

        const progress = applyLevelUps(id, 250, scope);
        return { ok: true, amount: moneyInt(payout), xp: moneyInt(xpGain), ...progress };
    });
}

async function claimDaily(id, reward, cooldownMs, xpGain = 25, scope = GLOBAL_SCOPE) {
    return claimTimed(id, "daily", cooldownMs, reward, xpGain, scope);
}

async function claimWork(id, payout, cooldownMs, xpGain = 15, scope = GLOBAL_SCOPE) {
    return claimTimed(id, "work", cooldownMs, payout, xpGain, scope);
}

async function commitCrime(id, cooldownMs, success, payout, fine, xpGain = 20, scope = GLOBAL_SCOPE) {
    getUser(id, scope);
    const now = Date.now();
    const w = walletRef(scope, id);

    return withTransaction(() => {
        const ready = db.run(
            `UPDATE ${w.table} SET crime = ?, last_active = ? WHERE ${w.where} AND (? - crime >= ?)`,
            now,
            now,
            ...w.keys,
            now,
            cooldownMs
        );

        if (ready.changes === 0) {
            const row = db.get(`SELECT crime AS t FROM ${w.table} WHERE ${w.where}`, ...w.keys);
            return { ok: false, nextAt: (row?.t ?? 0) + cooldownMs };
        }

        if (success) {
            db.run(
                `UPDATE ${w.table} SET balance = balance + ?, xp = xp + ? WHERE ${w.where}`,
                moneyInt(payout),
                moneyInt(xpGain),
                ...w.keys
            );
            const progress = applyLevelUps(id, 250, scope);
            return { ok: true, success: true, amount: moneyInt(payout), xp: moneyInt(xpGain), ...progress };
        }

        const paid = cashSpend(id, fine, scope);

        if (!paid.changes) {
            db.run(`UPDATE ${w.table} SET balance = 0 WHERE ${w.where}`, ...w.keys);
            return { ok: true, success: false, amount: 0, wiped: true };
        }

        return { ok: true, success: false, amount: moneyInt(fine), wiped: false };
    });
}

async function attemptRob(fromId, toId, cooldownMs, success, steal, fine, minCash = 1, maxSteal = ROB_MAX_STEAL, scope = GLOBAL_SCOPE) {
    getUser(fromId, scope);
    getUser(toId, scope);
    const now = Date.now();
    const need = Math.max(1, Number(minCash) || 1);
    const cap = Math.max(1, moneyInt(maxSteal, ROB_MAX_STEAL) || ROB_MAX_STEAL);
    const thief = walletRef(scope, fromId);
    const victim = walletRef(scope, toId);

    return withTransaction(() => {
        const target = db.get(
            `SELECT balance FROM ${victim.table} WHERE ${victim.where}`,
            ...victim.keys
        );
        const cash = Number(target?.balance) || 0;

        if (cash < need) {
            return { ok: false, reason: "empty" };
        }

        const ready = db.run(
            `UPDATE ${thief.table} SET rob = ?, last_active = ? WHERE ${thief.where} AND (? - rob >= ?)`,
            now,
            now,
            ...thief.keys,
            now,
            cooldownMs
        );

        if (ready.changes === 0) {
            const row = db.get(`SELECT rob AS t FROM ${thief.table} WHERE ${thief.where}`, ...thief.keys);
            return { ok: false, reason: "cooldown", nextAt: (row?.t ?? 0) + cooldownMs };
        }

        if (!success) {
            const paid = cashSpend(fromId, fine, scope);

            if (!paid.changes) {
                db.run(`UPDATE ${thief.table} SET balance = 0 WHERE ${thief.where}`, ...thief.keys);
                return { ok: true, success: false, amount: 0, wiped: true };
            }

            cashAdd(toId, fine, scope);
            return { ok: true, success: false, amount: moneyInt(fine), wiped: false };
        }

        const amount = Math.min(moneyInt(steal), cash, cap);
        const stolen = cashSpend(toId, amount, scope);

        if (!stolen.changes) {
            return { ok: false, reason: "empty" };
        }

        db.run(
            `UPDATE ${thief.table} SET balance = balance + ?, xp = xp + ? WHERE ${thief.where}`,
            amount,
            20,
            ...thief.keys
        );
        const progress = applyLevelUps(fromId, 250, scope);
        return { ok: true, success: true, amount, ...progress };
    });
}

async function flipBet(id, amount, win, scope = GLOBAL_SCOPE) {
    const bet = moneyInt(amount);
    if (bet < 1) {
        return { ok: false, reason: "invalid" };
    }
    getUser(id, scope);

    return withTransaction(() => {
        const spent = cashSpend(id, bet, scope);
        if (spent.changes === 0) {
            return { ok: false, reason: "insufficient" };
        }
        if (win) {
            cashAdd(id, bet * 2, scope);
        }
        return { ok: true, win, amount: bet };
    });
}

async function transfer(fromId, toId, amount, scope = GLOBAL_SCOPE) {
    const bet = moneyInt(amount);
    if (bet < 1) {
        return { ok: false, reason: "invalid" };
    }
    getUser(fromId, scope);
    getUser(toId, scope);

    return withTransaction(() => {
        const spent = cashSpend(fromId, bet, scope);
        if (spent.changes === 0) {
            return { ok: false, reason: "insufficient" };
        }
        cashAdd(toId, bet, scope);
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
    const row = db.get("SELECT COUNT(*) AS n FROM users");
    return Number(row?.n) || 0;
}

async function deposit(id, amount, scope = GLOBAL_SCOPE) {
    const bet = moneyInt(amount);
    if (bet < 1) {
        return { ok: false };
    }
    getUser(id, scope);
    const sid = normScope(scope);

    return withTransaction(() => {
        if (isGuildScope(sid)) {
            const result = db.run(
                `UPDATE guild_wallets
                 SET balance = balance - ?, bank = bank + ?
                 WHERE guild_id = ? AND user_id = ? AND balance >= ?`,
                bet,
                bet,
                sid,
                String(id),
                bet
            );
            return { ok: result.changes > 0 };
        }
        const result = db.run(
            `UPDATE users
             SET balance = balance - ?, bank = bank + ?
             WHERE id = ? AND balance >= ?`,
            bet,
            bet,
            id,
            bet
        );
        return { ok: result.changes > 0 };
    });
}

async function withdraw(id, amount, scope = GLOBAL_SCOPE) {
    const bet = moneyInt(amount);
    if (bet < 1) {
        return { ok: false };
    }
    getUser(id, scope);
    const sid = normScope(scope);

    return withTransaction(() => {
        if (isGuildScope(sid)) {
            const result = db.run(
                `UPDATE guild_wallets
                 SET balance = balance + ?, bank = bank - ?
                 WHERE guild_id = ? AND user_id = ? AND bank >= ?`,
                bet,
                bet,
                sid,
                String(id),
                bet
            );
            return { ok: result.changes > 0 };
        }
        const result = db.run(
            `UPDATE users
             SET balance = balance + ?, bank = bank - ?
             WHERE id = ? AND bank >= ?`,
            bet,
            bet,
            id,
            bet
        );
        return { ok: result.changes > 0 };
    });
}

async function getInventory(id, scope = GLOBAL_SCOPE) {
    getUser(id, scope);
    const sid = normScope(scope);
    if (isGuildScope(sid)) {
        return db.all(
            "SELECT item_id, qty FROM guild_inventory WHERE guild_id = ? AND user_id = ? AND qty > 0 ORDER BY qty DESC",
            sid,
            String(id)
        );
    }
    return db.all(
        "SELECT item_id, qty FROM inventory WHERE user_id = ? AND qty > 0 ORDER BY qty DESC",
        String(id)
    );
}

async function buyItem(id, itemId, price, qty, scope = GLOBAL_SCOPE) {
    const cost = moneyInt(price) * Math.max(1, moneyInt(qty, 1));
    getUser(id, scope);
    const sid = normScope(scope);

    return withTransaction(() => {
        const spent = cashSpend(id, cost, scope);
        if (spent.changes === 0) {
            return { ok: false, reason: "insufficient" };
        }

        if (isGuildScope(sid)) {
            db.run(
                `INSERT INTO guild_inventory(guild_id, user_id, item_id, qty) VALUES(?, ?, ?, ?)
                 ON CONFLICT(guild_id, user_id, item_id) DO UPDATE SET qty = qty + excluded.qty`,
                sid,
                String(id),
                itemId,
                Math.max(1, moneyInt(qty, 1))
            );
        } else {
            db.run(
                `INSERT INTO inventory(user_id, item_id, qty) VALUES(?, ?, ?)
                 ON CONFLICT(user_id, item_id) DO UPDATE SET qty = qty + excluded.qty`,
                String(id),
                itemId,
                Math.max(1, moneyInt(qty, 1))
            );
        }

        return { ok: true, cost };
    });
}

async function takeBalance(id, amount, scope = GLOBAL_SCOPE) {
    getUser(id, scope);
    const w = walletRef(scope, id);
    const bet = moneyInt(amount);

    return withTransaction(() => {
        const row = db.get(
            `SELECT balance, bank FROM ${w.table} WHERE ${w.where}`,
            ...w.keys
        );
        const cash = Number(row?.balance) || 0;
        const bank = Number(row?.bank) || 0;
        const total = cash + bank;

        if (total < bet) {
            return { ok: false, total };
        }

        const fromCash = Math.min(bet, cash);
        const fromBank = bet - fromCash;

        db.run(
            `UPDATE ${w.table} SET balance = balance - ?, bank = bank - ? WHERE ${w.where}`,
            fromCash,
            fromBank,
            ...w.keys
        );

        return { ok: true, amount: bet, fromCash, fromBank };
    });
}

const STAFF_RANK = {
    none: 0,
    mod: 1,
    senior: 2
};

function normalizeStaffRank(rank) {
    return Number(rank) >= 2 ? STAFF_RANK.senior : STAFF_RANK.mod;
}

async function isStaff(id) {
    const row = db.get(
        "SELECT user_id FROM staff WHERE user_id = ?",
        String(id)
    );
    return Boolean(row);
}

async function getStaffRank(id) {
    const row = db.get(
        "SELECT rank FROM staff WHERE user_id = ?",
        String(id)
    );
    return Number(row?.rank) || 0;
}

async function addStaff(id, addedBy, rank = STAFF_RANK.mod) {
    const userId = String(id);
    const safeRank = normalizeStaffRank(rank);
    const existed = await isStaff(userId);
    db.run(
        `INSERT INTO staff(user_id, added_by, added_at, rank)
         VALUES(?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
            rank = excluded.rank,
            added_by = excluded.added_by`,
        userId,
        String(addedBy),
        Date.now(),
        safeRank
    );
    return { created: !existed, rank: safeRank };
}

async function removeStaff(id) {
    const result = db.run(
        "DELETE FROM staff WHERE user_id = ?",
        String(id)
    );
    return result.changes > 0;
}

async function listStaff() {
    return db.all("SELECT user_id, added_by, added_at, rank FROM staff ORDER BY rank DESC, added_at ASC");
}

function asSession(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        user: JSON.parse(row.user_json || "{}"),
        guilds: JSON.parse(row.guilds_json || "[]"),
        token: row.access_token || "",
        refresh_token: row.refresh_token || "",
        expires_at: Number(row.expires_at) || 0,
        createdAt: Number(row.created_at) || 0,
        lastSeen: Number(row.last_seen) || 0
    };
}

async function saveWebSession(id, data) {
    const now = Date.now();
    db.run(
        `INSERT INTO web_sessions(
            id, user_json, guilds_json, access_token, refresh_token, expires_at, created_at, last_seen
         ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            user_json = excluded.user_json,
            guilds_json = excluded.guilds_json,
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            expires_at = excluded.expires_at,
            last_seen = excluded.last_seen`,
        id,
        JSON.stringify(data.user || {}),
        JSON.stringify(Array.isArray(data.guilds) ? data.guilds : []),
        data.token || data.access_token || "",
        data.refresh_token || "",
        Number(data.expires_at) || 0,
        Number(data.createdAt) || now,
        now
    );
}

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

async function getWebSession(id) {
    if (!id || !db) {
        return null;
    }

    const row = db.get("SELECT * FROM web_sessions WHERE id = ?", id);
    if (!row) {
        return null;
    }

    const lastSeen = Number(row.last_seen) || Number(row.created_at) || 0;
    if (Date.now() - lastSeen > SESSION_TTL) {
        await deleteWebSession(id);
        return null;
    }

    db.run("UPDATE web_sessions SET last_seen = ? WHERE id = ?", Date.now(), id);
    return asSession(row);
}

async function deleteWebSession(id) {
    if (!id || !db) {
        return;
    }
    db.run("DELETE FROM web_sessions WHERE id = ?", id);
}

function legacyEvent(name, settings) {
    if (name === "join") {
        return {
            enabled: settings.welcomeOn,
            channel: settings.welcomeChannel,
            message: settings.welcomeMessage
        };
    }
    if (name === "leave") {
        return {
            enabled: settings.welcomeOn,
            channel: settings.welcomeChannel,
            message: settings.leaveMessage
        };
    }
    if (name === "ban" || name === "unban" || name === "kick" || name === "automodLog") {
        return {
            enabled: settings.logMod,
            channel: settings.logChannel,
            message: ""
        };
    }
    if (name === "messageDelete" || name === "messageUpdate") {
        return {
            enabled: settings.logMessages,
            channel: settings.logChannel,
            message: ""
        };
    }
    if (name === "boost") {
        return {
            enabled: settings.logJoins,
            channel: settings.logChannel,
            message: ""
        };
    }
    if (name === "levelUp") {
        return {
            enabled: settings.levelsOn,
            channel: settings.levelsChannel,
            message: settings.levelsMessage
        };
    }
    return { enabled: false, channel: "", message: "" };
}

async function getGuildEvent(guildId, name) {
    const row = db.get(
        "SELECT enabled, channel, message FROM guild_events WHERE guild_id = ? AND name = ?",
        String(guildId),
        name
    );
    if (row) {
        return {
            enabled: Number(row.enabled) !== 0,
            channel: row.channel || "",
            message: row.message || ""
        };
    }
    return legacyEvent(name, await getGuildSettings(guildId));
}

async function saveGuildEvent(guildId, name, patch = {}) {
    const current = await getGuildEvent(guildId, name);
    const next = {
        enabled: patch.enabled === undefined ? current.enabled : Boolean(patch.enabled),
        channel: snowflake(patch.channel === undefined ? current.channel : patch.channel),
        message: String(patch.message === undefined ? current.message : patch.message).slice(0, 2000)
    };

    db.run(
        `INSERT INTO guild_events(guild_id, name, enabled, channel, message)
         VALUES(?, ?, ?, ?, ?)
         ON CONFLICT(guild_id, name) DO UPDATE SET
            enabled = excluded.enabled,
            channel = excluded.channel,
            message = excluded.message`,
        String(guildId),
        name,
        next.enabled ? 1 : 0,
        next.channel,
        next.message
    );
    return next;
}

async function listGuildEvents(guildId) {
    const { EVENT_TYPES } = require("../Utils/events");
    const result = {};
    for (const type of EVENT_TYPES) {
        result[type.id] = await getGuildEvent(guildId, type.id);
    }
    return result;
}

function cleanItemId(id) {
    return String(id ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}

function parseExtra(raw) {
    if (!raw) {
        return {};
    }
    if (typeof raw === "object") {
        return raw;
    }
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        const hex = String(raw).trim();
        return /^#?[0-9a-fA-F]{6}$/.test(hex) ? { hex: hex.startsWith("#") ? hex : `#${hex}` } : {};
    }
}

function cleanHex(value) {
    const raw = String(value ?? "").trim();
    return isHexColor(raw) ? raw.toUpperCase() : "";
}

function asShopItem(row) {
    const extra = parseExtra(row.extra);
    const kind = row.kind === "role" ? "role" : "item";
    return {
        id: row.id,
        name: row.name,
        emoji: row.emoji || "",
        price: Number(row.price) || 0,
        description: row.description || "",
        scope: row.scope,
        kind,
        extra,
        hex: extra.hex || extra.color || ""
    };
}

async function listShopItems(scope) {
    const rows = db.all(
        "SELECT * FROM shop_items WHERE scope = ? ORDER BY price ASC, name ASC",
        String(scope)
    );
    return rows.map(asShopItem);
}

async function listShop(guildId, settings) {
    const conf = settings || (guildId ? await getGuildSettings(guildId) : {});
    const map = new Map();
    if (conf.shopGlobal !== false) {
        for (const item of await listShopItems("global")) {
            map.set(item.id, item);
        }
    }
    if (guildId && conf.shopGuild !== false) {
        for (const item of await listShopItems(String(guildId))) {
            map.set(item.id, item);
        }
    }
    return [...map.values()].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, "ru"));
}

async function getShopItem(guildId, itemId) {
    const key = cleanItemId(itemId);
    if (!key) {
        return null;
    }
    if (guildId) {
        const local = db.get(
            "SELECT * FROM shop_items WHERE scope = ? AND id = ?",
            String(guildId),
            key
        );
        if (local) {
            return asShopItem(local);
        }
    }
    const global = db.get(
        "SELECT * FROM shop_items WHERE scope = 'global' AND id = ?",
        key
    );
    return global ? asShopItem(global) : null;
}

async function findShopItem(itemId) {
    const key = cleanItemId(itemId);
    if (!key) {
        return null;
    }
    const row = db.get(
        "SELECT * FROM shop_items WHERE id = ? ORDER BY CASE scope WHEN 'global' THEN 1 ELSE 0 END LIMIT 1",
        key
    );
    if (row) {
        return asShopItem(row);
    }
    const named = db.get(
        "SELECT * FROM shop_items WHERE lower(name) = ? LIMIT 1",
        String(itemId ?? "").trim().toLowerCase()
    );
    return named ? asShopItem(named) : null;
}

async function saveShopItem(scope, item) {
    const id = cleanItemId(item.id);
    const name = String(item.name ?? "").trim().slice(0, 64);
    if (!id || !name) {
        return { ok: false, reason: "invalid" };
    }

    const kind = item.kind === "role" ? "role" : "item";
    const hex = cleanHex(item.hex || item.color || parseExtra(item.extra).hex);
    if (kind === "role" && !hex) {
        return { ok: false, reason: "hex" };
    }
    const extra = JSON.stringify({
        ...parseExtra(item.extra),
        hex
    });

    db.run(
        `INSERT INTO shop_items(scope, id, name, emoji, price, description, kind, extra)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(scope, id) DO UPDATE SET
            name = excluded.name,
            emoji = excluded.emoji,
            price = excluded.price,
            description = excluded.description,
            kind = excluded.kind,
            extra = excluded.extra`,
        String(scope),
        id,
        name,
        String(item.emoji ?? "").slice(0, 16),
        Math.max(0, Math.min(100000000, moneyInt(item.price))),
        String(item.description ?? "").slice(0, 240),
        kind,
        extra
    );
    return { ok: true, id, kind };
}

async function deleteShopItem(scope, id) {
    const result = db.run(
        "DELETE FROM shop_items WHERE scope = ? AND id = ?",
        String(scope),
        cleanItemId(id)
    );
    return result.changes > 0;
}

async function setWallet(id, patch = {}, scope) {
    return setUser(id, patch, scope);
}

async function setUser(id, patch = {}, scope = GLOBAL_SCOPE) {
    getUser(id, scope);
    const w = walletRef(scope, id);
    const map = {
        balance: "balance",
        bank: "bank",
        xp: "xp",
        level: "level",
        daily: "daily",
        work: "work",
        crime: "crime",
        rob: "rob",
        btc: "btc",
        lastWork: "last_work",
        lastActive: "last_active"
    };
    for (const [key, column] of Object.entries(map)) {
        if (patch[key] === undefined) {
            continue;
        }
        const value = Math.max(0, Math.min(1e12, Math.floor(Number(patch[key]) || 0)));
        db.run(`UPDATE ${w.table} SET ${column} = ? WHERE ${w.where}`, value, ...w.keys);
    }
    if (patch.job !== undefined) {
        db.run(
            `UPDATE ${w.table} SET job = ? WHERE ${w.where}`,
            String(patch.job ?? "").trim().slice(0, 32),
            ...w.keys
        );
    }
    return getUser(id, scope);
}

async function resetCooldowns(id, scope = GLOBAL_SCOPE) {
    getUser(id, scope);
    const w = walletRef(scope, id);
    db.run(
        `UPDATE ${w.table} SET daily = 0, work = 0, crime = 0, rob = 0 WHERE ${w.where}`,
        ...w.keys
    );
    return getUser(id, scope);
}

async function deleteUser(id) {
    const userId = String(id);
    db.run("DELETE FROM inventory WHERE user_id = ?", userId);
    db.run("DELETE FROM businesses WHERE user_id = ?", userId);
    const result = db.run("DELETE FROM users WHERE id = ?", userId);
    return result.changes > 0;
}

async function setInventoryItem(userId, itemId, qty, scope = GLOBAL_SCOPE) {
    const id = String(userId);
    const item = String(itemId ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
    const n = Math.floor(Number(qty) || 0);
    getUser(id, scope);
    if (!item) {
        return false;
    }
    const sid = normScope(scope);
    if (n <= 0) {
        if (isGuildScope(sid)) {
            db.run(
                "DELETE FROM guild_inventory WHERE guild_id = ? AND user_id = ? AND item_id = ?",
                sid,
                id,
                item
            );
        } else {
            db.run("DELETE FROM inventory WHERE user_id = ? AND item_id = ?", id, item);
        }
        return true;
    }
    if (isGuildScope(sid)) {
        db.run(
            `INSERT INTO guild_inventory(guild_id, user_id, item_id, qty) VALUES(?, ?, ?, ?)
             ON CONFLICT(guild_id, user_id, item_id) DO UPDATE SET qty = excluded.qty`,
            sid,
            id,
            item,
            n
        );
    } else {
        db.run(
            `INSERT INTO inventory(user_id, item_id, qty) VALUES(?, ?, ?)
             ON CONFLICT(user_id, item_id) DO UPDATE SET qty = excluded.qty`,
            id,
            item,
            n
        );
    }
    return true;
}

function likeQuery(query) {
    return `%${String(query ?? "").trim().replace(/[%_]/g, "")}%`;
}

async function searchUsers(query, limit = 20) {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
    const q = String(query ?? "").trim();
    if (!q) {
        return db.all(
            "SELECT * FROM users ORDER BY (balance + bank) DESC, balance DESC LIMIT ?",
            safeLimit
        );
    }
    const like = likeQuery(q);
    return db.all(
        `SELECT * FROM users
         WHERE id LIKE ? OR username LIKE ?
         ORDER BY (balance + bank) DESC
         LIMIT ?`,
        like,
        like,
        safeLimit
    );
}

async function touchProfile(id, patch = {}) {
    const userId = String(id);
    getUser(userId);
    const username = String(patch.username ?? "").trim().slice(0, 64);
    const avatar = String(patch.avatar ?? "").trim().slice(0, 128);
    if (!username && !avatar) {
        return getUser(userId);
    }
    db.run(
        "UPDATE users SET username = CASE WHEN ? = '' THEN username ELSE ? END, avatar = CASE WHEN ? = '' THEN avatar ELSE ? END WHERE id = ?",
        username,
        username,
        avatar,
        avatar,
        userId
    );
    return getUser(userId);
}

async function setJob(id, job, scope = GLOBAL_SCOPE) {
    getUser(id, scope);
    const w = walletRef(scope, id);
    db.run(
        `UPDATE ${w.table} SET job = ?, last_work = ? WHERE ${w.where}`,
        String(job ?? "").trim().slice(0, 32),
        Date.now(),
        ...w.keys
    );
    return getUser(id, scope);
}

function asCustomCommand(row) {
    if (!row) {
        return null;
    }
    return {
        name: row.name,
        response: row.response || "",
        title: row.title || "",
        color: row.color || "",
        image: row.image || "",
        thumbnail: row.thumbnail || "",
        footer: row.footer || "",
        content: row.content || "",
        author: row.author || "",
        authorIcon: row.author_icon || "",
        url: row.url || "",
        footerIcon: row.footer_icon || "",
        fields: row.fields || "",
        timestamp: Number(row.timestamp) !== 0
    };
}

function asGuildSettings(row, id) {
    return {
        id,
        prefix: Number(row?.prefix) !== 0,
        prefixText: row?.prefix_text || PREFIX,
        welcomeOn: Number(row?.welcome_on) !== 0,
        welcomeChannel: row?.welcome_channel || "",
        welcomeMessage: row?.welcome_message || "",
        leaveMessage: row?.leave_message || "",
        autoroles: parseIdList(row?.autorole_ids),
        logChannel: row?.log_channel || "",
        logJoins: Number(row?.log_joins) !== 0,
        logMessages: Number(row?.log_messages) !== 0,
        logMod: Number(row?.log_mod) !== 0,
        levelsOn: Number(row?.levels_on) !== 0,
        levelsChannel: row?.levels_channel || "",
        levelsMessage: row?.levels_message || "",
        automodInvites: Number(row?.automod_invites) !== 0,
        automodWords: row?.automod_words || "",
        automodLinks: row?.automod_links == null
            ? Number(row?.automod_invites) !== 0
            : Number(row.automod_links) !== 0,
        automodSpam: Number(row?.automod_spam) !== 0,
        automodSwear: row?.automod_swear == null
            ? Boolean(row?.automod_words)
            : Number(row.automod_swear) !== 0,
        automodCaps: Number(row?.automod_caps) !== 0,
        automodFineLinks: Math.max(0, Number(row?.automod_fine_links) || 0),
        automodFineSpam: Math.max(0, Number(row?.automod_fine_spam) || 0),
        automodFineSwear: Math.max(0, Number(row?.automod_fine_swear) || 0),
        automodFineCaps: Math.max(0, Number(row?.automod_fine_caps) || 0),
        disabledCommands: String(row?.disabled_commands || "")
            .split(",")
            .map(name => name.trim())
            .filter(Boolean),
        xpOn: row?.xp_on == null ? true : Number(row.xp_on) !== 0,
        levelMoney: Math.max(0, Number(row?.level_money) || 250),
        dailyMin: Math.max(0, Number(row?.daily_min) || 300),
        dailyMax: Math.max(0, Number(row?.daily_max) || 1100),
        workMin: Math.max(0, Number(row?.work_min) || 70),
        workMax: Math.max(0, Number(row?.work_max) || 260),
        crimeMin: Math.max(0, Number(row?.crime_min) || 180),
        crimeMax: Math.max(0, Number(row?.crime_max) || 480),
        crimeFineMin: Math.max(0, Number(row?.crime_fine_min) || 80),
        crimeFineMax: Math.max(0, Number(row?.crime_fine_max) || 220),
        walletScope: row?.wallet_scope === "guild" ? "guild" : "global",
        jobsGlobal: row?.jobs_global == null ? true : Number(row.jobs_global) !== 0,
        jobsGuild: Number(row?.jobs_guild) !== 0,
        bizGlobal: row?.biz_global == null ? true : Number(row.biz_global) !== 0,
        bizGuild: Number(row?.biz_guild) !== 0,
        shopGlobal: row?.shop_global == null ? true : Number(row.shop_global) !== 0,
        shopGuild: row?.shop_guild == null ? true : Number(row.shop_guild) !== 0,
        earnOn: row?.earn_on == null ? true : Number(row.earn_on) !== 0,
        economyOn: row?.economy_on == null ? true : Number(row.economy_on) !== 0,
        penaltiesOn: row?.penalties_on == null ? true : Number(row.penalties_on) !== 0,
        paused: Number(row?.paused) !== 0,
        flipMax: Math.max(1, Number(row?.flip_max) || FLIP_MAX_BET),
        robMax: Math.max(1, Number(row?.rob_max) || ROB_MAX_STEAL)
    };
}

async function getGuildSettings(guildId) {
    const id = String(guildId);
    const inserted = db.run(
        "INSERT OR IGNORE INTO guilds(id, prefix_text) VALUES(?, ?)",
        id,
        PREFIX
    );

    let row = db.get("SELECT * FROM guilds WHERE id = ?", id);
    const settings = asGuildSettings(row, id);
    settingsCache.put(settings);
    return settings;
}

function listGuildSettings() {
    const rows = db.all("SELECT * FROM guilds");
    return rows.map(row => asGuildSettings(row, row.id));
}

function warmGuildCache() {
    settingsCache.warm(listGuildSettings());
    return settingsCache.size();
}

function pick(patch, current, key) {
    return patch[key] === undefined ? current[key] : patch[key];
}

function clampPair(min, max, fallbackMin, fallbackMax) {
    let low = Math.max(0, Math.min(1e9, Math.floor(Number(min))));
    let high = Math.max(0, Math.min(1e9, Math.floor(Number(max))));
    if (!Number.isFinite(low)) {
        low = fallbackMin;
    }
    if (!Number.isFinite(high)) {
        high = fallbackMax;
    }
    if (high < low) {
        high = low;
    }
    return [low, high];
}

async function saveGuildSettings(guildId, patch) {
    const id = String(guildId);
    const current = await getGuildSettings(id);
    const [dailyMin, dailyMax] = clampPair(
        pick(patch, current, "dailyMin"),
        pick(patch, current, "dailyMax"),
        300,
        1100
    );
    const [workMin, workMax] = clampPair(
        pick(patch, current, "workMin"),
        pick(patch, current, "workMax"),
        70,
        260
    );
    const [crimeMin, crimeMax] = clampPair(
        pick(patch, current, "crimeMin"),
        pick(patch, current, "crimeMax"),
        180,
        480
    );
    const [crimeFineMin, crimeFineMax] = clampPair(
        pick(patch, current, "crimeFineMin"),
        pick(patch, current, "crimeFineMax"),
        80,
        220
    );
    const next = {
        prefix: pick(patch, current, "prefix") ? 1 : 0,
        prefixText: String(pick(patch, current, "prefixText") ?? PREFIX).trim().slice(0, 8) || PREFIX,
        welcomeOn: pick(patch, current, "welcomeOn") ? 1 : 0,
        welcomeChannel: snowflake(pick(patch, current, "welcomeChannel")),
        welcomeMessage: String(pick(patch, current, "welcomeMessage") ?? "").slice(0, 1000),
        leaveMessage: String(pick(patch, current, "leaveMessage") ?? "").slice(0, 1000),
        autoroles: parseIdList(pick(patch, current, "autoroles")),
        logChannel: snowflake(pick(patch, current, "logChannel")),
        logJoins: pick(patch, current, "logJoins") ? 1 : 0,
        logMessages: pick(patch, current, "logMessages") ? 1 : 0,
        logMod: pick(patch, current, "logMod") ? 1 : 0,
        levelsOn: pick(patch, current, "levelsOn") ? 1 : 0,
        levelsChannel: snowflake(pick(patch, current, "levelsChannel")),
        levelsMessage: String(pick(patch, current, "levelsMessage") ?? "").slice(0, 1000),
        automodInvites: pick(patch, current, "automodInvites") ? 1 : 0,
        automodWords: parseWords(pick(patch, current, "automodWords")).join("\n"),
        automodLinks: pick(patch, current, "automodLinks") != null
            ? (pick(patch, current, "automodLinks") ? 1 : 0)
            : (pick(patch, current, "automodInvites") ? 1 : 0),
        automodSpam: pick(patch, current, "automodSpam") ? 1 : 0,
        automodSwear: pick(patch, current, "automodSwear") ? 1 : 0,
        automodCaps: pick(patch, current, "automodCaps") ? 1 : 0,
        automodFineLinks: moneyInt(pick(patch, current, "automodFineLinks")),
        automodFineSpam: moneyInt(pick(patch, current, "automodFineSpam")),
        automodFineSwear: moneyInt(pick(patch, current, "automodFineSwear")),
        automodFineCaps: moneyInt(pick(patch, current, "automodFineCaps")),
        disabledCommands: Array.isArray(pick(patch, current, "disabledCommands"))
            ? pick(patch, current, "disabledCommands")
            : String(pick(patch, current, "disabledCommands") || "")
                .split(",")
                .map(name => name.trim())
                .filter(Boolean),
        xpOn: pick(patch, current, "xpOn") ? 1 : 0,
        levelMoney: Math.max(0, Math.min(1e12, Number(pick(patch, current, "levelMoney")) || 0)),
        dailyMin,
        dailyMax,
        workMin,
        workMax,
        crimeMin,
        crimeMax,
        crimeFineMin,
        crimeFineMax,
        walletScope: pick(patch, current, "walletScope") === "guild" ? "guild" : "global",
        jobsGlobal: pick(patch, current, "jobsGlobal") ? 1 : 0,
        jobsGuild: pick(patch, current, "jobsGuild") ? 1 : 0,
        bizGlobal: pick(patch, current, "bizGlobal") ? 1 : 0,
        bizGuild: pick(patch, current, "bizGuild") ? 1 : 0,
        shopGlobal: pick(patch, current, "shopGlobal") ? 1 : 0,
        shopGuild: pick(patch, current, "shopGuild") ? 1 : 0,
        earnOn: pick(patch, current, "earnOn") ? 1 : 0,
        economyOn: pick(patch, current, "economyOn") ? 1 : 0,
        penaltiesOn: pick(patch, current, "penaltiesOn") ? 1 : 0,
        paused: pick(patch, current, "paused") ? 1 : 0,
        flipMax: clampGuildCap(pick(patch, current, "flipMax"), FLIP_MAX_BET),
        robMax: clampGuildCap(pick(patch, current, "robMax"), ROB_MAX_STEAL)
    };
    next.automodInvites = next.automodLinks;

    db.run(
        `INSERT INTO guilds(
            id, prefix, prefix_text, welcome_on, welcome_channel, welcome_message, leave_message,
            autorole_ids, log_channel, log_joins, log_messages, log_mod,
            levels_on, levels_channel, levels_message, automod_invites, automod_words,
            automod_links, automod_spam, automod_swear, automod_caps,
            automod_fine_links, automod_fine_spam, automod_fine_swear, automod_fine_caps,
            disabled_commands, xp_on, level_money,
            daily_min, daily_max, work_min, work_max, crime_min, crime_max, crime_fine_min, crime_fine_max,
            wallet_scope, jobs_global, jobs_guild, biz_global, biz_guild, shop_global, shop_guild,
            earn_on, economy_on, penalties_on, paused, flip_max, rob_max
         ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            prefix = excluded.prefix,
            prefix_text = excluded.prefix_text,
            welcome_on = excluded.welcome_on,
            welcome_channel = excluded.welcome_channel,
            welcome_message = excluded.welcome_message,
            leave_message = excluded.leave_message,
            autorole_ids = excluded.autorole_ids,
            log_channel = excluded.log_channel,
            log_joins = excluded.log_joins,
            log_messages = excluded.log_messages,
            log_mod = excluded.log_mod,
            levels_on = excluded.levels_on,
            levels_channel = excluded.levels_channel,
            levels_message = excluded.levels_message,
            automod_invites = excluded.automod_invites,
            automod_words = excluded.automod_words,
            automod_links = excluded.automod_links,
            automod_spam = excluded.automod_spam,
            automod_swear = excluded.automod_swear,
            automod_caps = excluded.automod_caps,
            automod_fine_links = excluded.automod_fine_links,
            automod_fine_spam = excluded.automod_fine_spam,
            automod_fine_swear = excluded.automod_fine_swear,
            automod_fine_caps = excluded.automod_fine_caps,
            disabled_commands = excluded.disabled_commands,
            xp_on = excluded.xp_on,
            level_money = excluded.level_money,
            daily_min = excluded.daily_min,
            daily_max = excluded.daily_max,
            work_min = excluded.work_min,
            work_max = excluded.work_max,
            crime_min = excluded.crime_min,
            crime_max = excluded.crime_max,
            crime_fine_min = excluded.crime_fine_min,
            crime_fine_max = excluded.crime_fine_max,
            wallet_scope = excluded.wallet_scope,
            jobs_global = excluded.jobs_global,
            jobs_guild = excluded.jobs_guild,
            biz_global = excluded.biz_global,
            biz_guild = excluded.biz_guild,
            shop_global = excluded.shop_global,
            shop_guild = excluded.shop_guild,
            earn_on = excluded.earn_on,
            economy_on = excluded.economy_on,
            penalties_on = excluded.penalties_on,
            paused = excluded.paused,
            flip_max = excluded.flip_max,
            rob_max = excluded.rob_max`,
        id,
        next.prefix,
        next.prefixText,
        next.welcomeOn,
        next.welcomeChannel,
        next.welcomeMessage,
        next.leaveMessage,
        next.autoroles.join(","),
        next.logChannel,
        next.logJoins,
        next.logMessages,
        next.logMod,
        next.levelsOn,
        next.levelsChannel,
        next.levelsMessage,
        next.automodInvites,
        next.automodWords,
        next.automodLinks,
        next.automodSpam,
        next.automodSwear,
        next.automodCaps,
        next.automodFineLinks,
        next.automodFineSpam,
        next.automodFineSwear,
        next.automodFineCaps,
        next.disabledCommands.join(","),
        next.xpOn,
        next.levelMoney,
        next.dailyMin,
        next.dailyMax,
        next.workMin,
        next.workMax,
        next.crimeMin,
        next.crimeMax,
        next.crimeFineMin,
        next.crimeFineMax,
        next.walletScope,
        next.jobsGlobal,
        next.jobsGuild,
        next.bizGlobal,
        next.bizGuild,
        next.shopGlobal,
        next.shopGuild,
        next.earnOn,
        next.economyOn,
        next.penaltiesOn,
        next.paused,
        next.flipMax,
        next.robMax
    );

    return getGuildSettings(id);
}

function cleanCommandName(name) {
    return String(name ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}

async function listCustomCommands(guildId) {
    const rows = db.all(
        "SELECT * FROM custom_commands WHERE guild_id = ? ORDER BY name",
        String(guildId)
    );
    return rows.map(asCustomCommand);
}

async function getCustomCommand(guildId, name) {
    const key = cleanCommandName(name);
    if (!key) {
        return null;
    }
    const row = db.get(
        "SELECT * FROM custom_commands WHERE guild_id = ? AND name = ?",
        String(guildId),
        key
    );
    return asCustomCommand(row);
}

async function saveCustomCommand(guildId, name, response, extra = {}) {
    const key = cleanCommandName(name);
    const data = typeof response === "object" && response !== null ? response : { response, ...extra };
    const text = String(data.response ?? "").trim().slice(0, 4096);
    const title = String(data.title ?? "").trim().slice(0, 256);
    const content = String(data.content ?? "").trim().slice(0, 2000);
    if (!key || (!text && !title && !content)) {
        return { ok: false, reason: "invalid" };
    }

    db.run(
        `INSERT INTO custom_commands(
            guild_id, name, response, title, color, image, thumbnail, footer,
            content, author, author_icon, url, footer_icon, fields, timestamp
         ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(guild_id, name) DO UPDATE SET
            response = excluded.response,
            title = excluded.title,
            color = excluded.color,
            image = excluded.image,
            thumbnail = excluded.thumbnail,
            footer = excluded.footer,
            content = excluded.content,
            author = excluded.author,
            author_icon = excluded.author_icon,
            url = excluded.url,
            footer_icon = excluded.footer_icon,
            fields = excluded.fields,
            timestamp = excluded.timestamp`,
        String(guildId),
        key,
        text,
        title,
        String(data.color ?? "").trim().slice(0, 16),
        String(data.image ?? "").trim().slice(0, 500),
        String(data.thumbnail ?? "").trim().slice(0, 500),
        String(data.footer ?? "").trim().slice(0, 2048),
        content,
        String(data.author ?? "").trim().slice(0, 256),
        String(data.authorIcon ?? data.author_icon ?? "").trim().slice(0, 500),
        String(data.url ?? "").trim().slice(0, 500),
        String(data.footerIcon ?? data.footer_icon ?? "").trim().slice(0, 500),
        String(data.fields ?? "").slice(0, 6000),
        data.timestamp ? 1 : 0
    );
    return { ok: true, name: key };
}

async function deleteCustomCommand(guildId, name) {
    const key = cleanCommandName(name);
    const result = db.run(
        "DELETE FROM custom_commands WHERE guild_id = ? AND name = ?",
        String(guildId),
        key
    );
    return result.changes > 0;
}

async function isPrefixEnabled(guildId) {
    if (!guildId) {
        return true;
    }

    const settings = await getGuildSettings(guildId);
    return settings.prefix;
}

async function setPrefixEnabled(guildId, enabled) {
    const current = await getGuildSettings(guildId);
    await saveGuildSettings(guildId, { ...current, prefix: enabled });
}

async function getKv(key) {
    const row = db.get("SELECT value FROM kv WHERE key = ?", String(key));
    return row ? row.value : null;
}

async function setKv(key, value) {
    db.run(
        `INSERT INTO kv(key, value) VALUES(?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        String(key),
        String(value)
    );
}

const BTC_MIN = 8000;
const BTC_MAX = 140000;
const BTC_BASE = 42000;

async function btcPrice(now = Date.now()) {
    return withTransaction(() => {
        const raw = db.get("SELECT value FROM kv WHERE key = ?", "btc_price");
        const tick = db.get("SELECT value FROM kv WHERE key = ?", "btc_tick");
        let price = Math.max(BTC_MIN, Math.min(BTC_MAX, Number(raw?.value) || BTC_BASE));
        const last = Number(tick?.value) || 0;
        if (now - last >= 60 * 1000) {
            const drift = Math.floor((Math.random() - 0.47) * 1800);
            price = Math.max(BTC_MIN, Math.min(BTC_MAX, price + drift));
            db.run(
                `INSERT INTO kv(key, value) VALUES('btc_price', ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
                String(price)
            );
            db.run(
                `INSERT INTO kv(key, value) VALUES('btc_tick', ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
                String(now)
            );
        }
        return price;
    });
}

async function buyBtc(id, coins, scope = GLOBAL_SCOPE) {
    const qty = Math.max(0, Math.floor(Number(coins) || 0));
    if (qty < 1) {
        return { ok: false, reason: "invalid" };
    }
    getUser(id, scope);

    return withTransaction(() => {
        const raw = db.get("SELECT value FROM kv WHERE key = ?", "btc_price");
        const price = Math.max(BTC_MIN, Math.min(BTC_MAX, Number(raw?.value) || BTC_BASE));
        const cost = price * qty;
        const spent = cashSpend(id, cost, scope);
        if (!spent.changes) {
            return { ok: false, reason: "insufficient", price, cost };
        }
        const w = walletRef(scope, id);
        db.run(
            `UPDATE ${w.table} SET btc = btc + ? WHERE ${w.where}`,
            qty,
            ...w.keys
        );
        return { ok: true, coins: qty, price, cost };
    });
}

async function sellBtc(id, coins, scope = GLOBAL_SCOPE) {
    const qty = Math.max(0, Math.floor(Number(coins) || 0));
    if (qty < 1) {
        return { ok: false, reason: "invalid" };
    }
    getUser(id, scope);
    const w = walletRef(scope, id);

    return withTransaction(() => {
        const raw = db.get("SELECT value FROM kv WHERE key = ?", "btc_price");
        const price = Math.max(BTC_MIN, Math.min(BTC_MAX, Number(raw?.value) || BTC_BASE));
        const payout = price * qty;
        const sold = db.run(
            `UPDATE ${w.table} SET btc = btc - ?, balance = balance + ? WHERE ${w.where} AND btc >= ?`,
            qty,
            payout,
            ...w.keys,
            qty
        );
        if (!sold.changes) {
            return { ok: false, reason: "insufficient", price };
        }
        return { ok: true, coins: qty, price, payout };
    });
}

function asBusiness(row) {
    if (!row) {
        return null;
    }
    const last = Number(row.last_revenue_collect) || Number(row.last_tick) || 0;
    return {
        userId: row.user_id,
        type: row.type,
        level: Math.max(1, Number(row.level) || 1),
        unclaimed: Math.max(0, Number(row.unclaimed) || 0),
        lastTick: last,
        lastRevenueCollect: last,
        stalled: Number(row.stalled) !== 0,
        boost: Math.max(0, Number(row.boost) || 0)
    };
}

function businessYield(def, level, elapsedMs, boost = 0) {
    const seconds = Math.max(0, elapsedMs) / 1000;
    const perMin = def.income * (1 + 0.25 * (Math.max(1, level) - 1));
    const mult = 1 + Math.max(0, Number(boost) || 0) / 100;
    return Math.floor((perMin / 60) * seconds * mult);
}

function settleBusiness(row, def, now, penaltiesOn = false) {
    const biz = asBusiness(row);
    const elapsed = Math.max(0, now - biz.lastRevenueCollect);
    const idle = elapsed > BIZ_IDLE_MS;
    if (penaltiesOn && (biz.stalled || idle)) {
        return {
            ...biz,
            stalled: true,
            unclaimed: biz.unclaimed,
            lastTick: now,
            lastRevenueCollect: biz.lastRevenueCollect
        };
    }
    const gained = businessYield(def, biz.level, elapsed, biz.boost);
    const cap = def.cap * biz.level;
    return {
        ...biz,
        stalled: false,
        unclaimed: Math.min(cap, biz.unclaimed + gained),
        lastTick: now,
        lastRevenueCollect: now
    };
}

async function getBusiness(userId, type, scope = GLOBAL_SCOPE) {
    const ref = bizRef(scope, userId, type);
    const row = db.get(
        `SELECT * FROM ${ref.table} WHERE ${ref.where}`,
        ...ref.keys
    );
    return asBusiness(row);
}

async function listBusinesses(userId, scope = GLOBAL_SCOPE) {
    const ref = bizRef(scope, userId, "");
    const rows = db.all(
        `SELECT * FROM ${ref.table} WHERE ${ref.listWhere} ORDER BY type`,
        ...ref.listKeys
    );
    return rows.map(asBusiness);
}

async function buyBusiness(userId, type, def, scope = GLOBAL_SCOPE) {
    getUser(userId, scope);
    const ref = bizRef(scope, userId, type);
    return withTransaction(() => {
        const exists = db.get(
            `SELECT type FROM ${ref.table} WHERE ${ref.where}`,
            ...ref.keys
        );
        if (exists) {
            return { ok: false, reason: "owned" };
        }
        const spent = cashSpend(userId, def.price, scope);
        if (!spent.changes) {
            return { ok: false, reason: "insufficient" };
        }
        const now = Date.now();
        db.run(ref.insert, ...ref.insertKeys(now));
        return { ok: true };
    });
}

async function upgradeBusiness(userId, type, def, scope = GLOBAL_SCOPE) {
    getUser(userId, scope);
    const ref = bizRef(scope, userId, type);
    return withTransaction(() => {
        const row = db.get(
            `SELECT * FROM ${ref.table} WHERE ${ref.where}`,
            ...ref.keys
        );
        if (!row) {
            return { ok: false, reason: "missing" };
        }
        const level = Math.max(1, Number(row.level) || 1);
        if (level >= def.maxLevel) {
            return { ok: false, reason: "max", level };
        }
        const cost = Math.floor(def.price * level * 1.6);
        const spent = cashSpend(userId, cost, scope);
        if (!spent.changes) {
            return { ok: false, reason: "insufficient", cost };
        }
        db.run(
            `UPDATE ${ref.table} SET level = level + 1 WHERE ${ref.where}`,
            ...ref.keys
        );
        return { ok: true, level: level + 1, cost };
    });
}

async function collectBusiness(userId, type, def, options = {}) {
    const scope = options.scope || GLOBAL_SCOPE;
    const now = options.now || Date.now();
    const penaltiesOn = Boolean(options.penaltiesOn);
    getUser(userId, scope);
    const ref = bizRef(scope, userId, type);
    return withTransaction(() => {
        const row = db.get(
            `SELECT * FROM ${ref.table} WHERE ${ref.where}`,
            ...ref.keys
        );
        if (!row) {
            return { ok: false, reason: "missing" };
        }
        const settled = settleBusiness(row, def, now, penaltiesOn);
        if (settled.stalled) {
            return { ok: false, reason: "stalled", stalled: true };
        }
        const amount = moneyInt(settled.unclaimed);
        if (amount < 1) {
            db.run(
                `UPDATE ${ref.table} SET unclaimed = 0, last_tick = ?, last_revenue_collect = ?, stalled = 0 WHERE ${ref.where}`,
                now,
                now,
                ...ref.keys
            );
            return { ok: false, reason: "empty", stalled: false };
        }
        db.run(
            `UPDATE ${ref.table} SET unclaimed = 0, last_tick = ?, last_revenue_collect = ?, stalled = 0 WHERE ${ref.where}`,
            now,
            now,
            ...ref.keys
        );
        cashAdd(userId, amount, scope);
        const w = walletRef(scope, userId);
        db.run(
            `UPDATE ${w.table} SET last_active = ? WHERE ${w.where}`,
            now,
            ...w.keys
        );
        return { ok: true, amount, level: settled.level };
    });
}

async function peekBusiness(userId, type, def, now = Date.now(), options = {}) {
    const scope = options.scope || GLOBAL_SCOPE;
    const penaltiesOn = Boolean(options.penaltiesOn);
    const ref = bizRef(scope, userId, type);
    const row = db.get(
        `SELECT * FROM ${ref.table} WHERE ${ref.where}`,
        ...ref.keys
    );
    if (!row) {
        return null;
    }
    return settleBusiness(row, def, now, penaltiesOn);
}

function restartFee(def) {
    return Math.max(100, Math.floor(moneyInt(def?.price) * 0.05));
}

async function restartBusiness(userId, type, def, options = {}) {
    const scope = options.scope || GLOBAL_SCOPE;
    const now = options.now || Date.now();
    const fee = restartFee(def);
    getUser(userId, scope);
    const ref = bizRef(scope, userId, type);
    return withTransaction(() => {
        const row = db.get(
            `SELECT * FROM ${ref.table} WHERE ${ref.where}`,
            ...ref.keys
        );
        if (!row) {
            return { ok: false, reason: "missing" };
        }
        const spent = cashSpend(userId, fee, scope);
        if (!spent.changes) {
            return { ok: false, reason: "insufficient", fee };
        }
        db.run(
            `UPDATE ${ref.table} SET stalled = 0, unclaimed = 0, last_tick = ?, last_revenue_collect = ? WHERE ${ref.where}`,
            now,
            now,
            ...ref.keys
        );
        return { ok: true, fee };
    });
}

async function pendingBusinessIncome(userId, defs, options = {}) {
    const now = options.now || Date.now();
    let total = 0;
    let stalled = 0;
    const items = [];
    for (const def of defs || []) {
        const peek = await peekBusiness(userId, def.id, def, now, options);
        if (!peek) {
            continue;
        }
        total += moneyInt(peek.unclaimed);
        if (peek.stalled) {
            stalled += 1;
        }
        items.push({ def, biz: peek });
    }
    return { total, stalled, items, count: items.length };
}

async function applyIdlePenalties(userId, scope = GLOBAL_SCOPE, settings = {}) {
    const user = getUser(userId, scope);
    const w = walletRef(scope, userId);
    db.run(
        `UPDATE ${w.table} SET last_active = ? WHERE ${w.where}`,
        Date.now(),
        ...w.keys
    );
    if (!settings?.penaltiesOn) {
        return { fired: false, user };
    }
    if (!user.job || user.job === "intern") {
        return { fired: false, user };
    }
    if (!user.lastWork) {
        return { fired: false, user };
    }
    if (Date.now() - user.lastWork < JOB_IDLE_MS) {
        return { fired: false, user };
    }
    db.run(
        `UPDATE ${w.table} SET job = ? WHERE ${w.where}`,
        "intern",
        ...w.keys
    );
    return { fired: true, job: user.job, user: getUser(userId, scope) };
}

async function snapshot(userId, scope = GLOBAL_SCOPE, settings = {}, defs = []) {
    const penalty = await applyIdlePenalties(userId, scope, settings);
    const user = penalty.user || getUser(userId, scope);
    const pending = await pendingBusinessIncome(userId, defs, {
        scope,
        penaltiesOn: Boolean(settings?.penaltiesOn)
    });
    return { user, penalty, pending };
}

async function getGuildStaffRank(guildId, userId) {
    if (!guildId || !userId) {
        return 0;
    }
    const row = db.get(
        "SELECT rank FROM guild_staff WHERE guild_id = ? AND user_id = ?",
        String(guildId),
        String(userId)
    );
    return Number(row?.rank) || 0;
}

async function addGuildStaff(guildId, userId, addedBy, rank = STAFF_RANK.mod) {
    const gid = String(guildId);
    const uid = String(userId);
    const existed = await getGuildStaffRank(gid, uid);
    db.run(
        `INSERT INTO guild_staff(guild_id, user_id, rank, added_by, added_at)
         VALUES(?, ?, ?, ?, ?)
         ON CONFLICT(guild_id, user_id) DO UPDATE SET
            rank = excluded.rank,
            added_by = excluded.added_by`,
        gid,
        uid,
        Number(rank) >= 2 ? STAFF_RANK.senior : STAFF_RANK.mod,
        String(addedBy),
        Date.now()
    );
    return { created: existed === 0, rank: Number(rank) >= 2 ? STAFF_RANK.senior : STAFF_RANK.mod };
}

async function removeGuildStaff(guildId, userId) {
    const result = db.run(
        "DELETE FROM guild_staff WHERE guild_id = ? AND user_id = ?",
        String(guildId),
        String(userId)
    );
    return result.changes > 0;
}

async function listGuildStaff(guildId) {
    return db.all(
        "SELECT user_id, added_by, added_at, rank FROM guild_staff WHERE guild_id = ? ORDER BY added_at ASC",
        String(guildId)
    );
}

async function listGuildStaffForUser(userId) {
    return db.all(
        "SELECT guild_id, user_id, rank FROM guild_staff WHERE user_id = ?",
        String(userId)
    );
}

function asCatalog(row) {
    if (!row) {
        return null;
    }
    return {
        scope: row.scope,
        kind: row.kind,
        id: row.id,
        name: row.name,
        extra: parseExtra(row.extra)
    };
}

async function listCatalog(scope, kind) {
    const rows = db.all(
        "SELECT * FROM catalogs WHERE scope = ? AND kind = ? ORDER BY name",
        String(scope),
        String(kind)
    );
    return rows.map(row => ({
        id: row.id,
        name: row.name,
        ...parseExtra(row.extra)
    }));
}

async function saveCatalogItem(scope, kind, item) {
    const id = cleanItemId(item.id);
    const name = String(item.name ?? "").trim().slice(0, 64);
    if (!id || !name) {
        return { ok: false, reason: "invalid" };
    }
    const extra = {
        emoji: String(item.emoji ?? "").slice(0, 16),
        price: moneyInt(item.price),
        income: moneyInt(item.income),
        cap: moneyInt(item.cap) || 1000,
        maxLevel: Math.max(1, moneyInt(item.maxLevel, 10) || 10),
        minLevel: Math.max(1, moneyInt(item.minLevel, 1) || 1),
        mult: Math.max(0.1, Number(item.mult) || 1),
        cooldown: moneyInt(item.cooldown)
    };
    db.run(
        `INSERT INTO catalogs(scope, kind, id, name, extra)
         VALUES(?, ?, ?, ?, ?)
         ON CONFLICT(scope, kind, id) DO UPDATE SET
            name = excluded.name,
            extra = excluded.extra`,
        String(scope),
        String(kind),
        id,
        name,
        JSON.stringify(extra)
    );
    return { ok: true, id };
}

async function deleteCatalogItem(scope, kind, id) {
    const result = db.run(
        "DELETE FROM catalogs WHERE scope = ? AND kind = ? AND id = ?",
        String(scope),
        String(kind),
        cleanItemId(id)
    );
    return result.changes > 0;
}

async function consumeItem(id, itemId, qty = 1, scope = GLOBAL_SCOPE) {
    const userId = String(id);
    const item = String(itemId ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
    const n = Math.max(1, Math.floor(Number(qty) || 1));
    if (!item) {
        return { ok: false, reason: "invalid" };
    }
    getUser(userId, scope);
    const sid = normScope(scope);

    return withTransaction(() => {
        if (!consumeQty(userId, item, n, sid)) {
            return { ok: false, reason: "missing" };
        }
        return { ok: true };
    });
}

function consumeQty(userId, item, n, sid) {
    let taken;
    if (isGuildScope(sid)) {
        taken = db.run(
            "UPDATE guild_inventory SET qty = qty - ? WHERE guild_id = ? AND user_id = ? AND item_id = ? AND qty >= ?",
            n,
            sid,
            userId,
            item,
            n
        );
        if (taken.changes) {
            db.run(
                "DELETE FROM guild_inventory WHERE guild_id = ? AND user_id = ? AND item_id = ? AND qty <= 0",
                sid,
                userId,
                item
            );
        }
    } else {
        taken = db.run(
            "UPDATE inventory SET qty = qty - ? WHERE user_id = ? AND item_id = ? AND qty >= ?",
            n,
            userId,
            item,
            n
        );
        if (taken.changes) {
            db.run(
                "DELETE FROM inventory WHERE user_id = ? AND item_id = ? AND qty <= 0",
                userId,
                item
            );
        }
    }
    return taken.changes > 0;
}

function grantItemSync(userId, itemId, qty, scope) {
    const item = cleanItemId(itemId);
    const n = Math.max(1, moneyInt(qty, 1) || 1);
    if (!item) {
        return false;
    }
    const sid = normScope(scope);
    if (isGuildScope(sid)) {
        db.run(
            `INSERT INTO guild_inventory(guild_id, user_id, item_id, qty) VALUES(?, ?, ?, ?)
             ON CONFLICT(guild_id, user_id, item_id) DO UPDATE SET qty = qty + excluded.qty`,
            sid,
            String(userId),
            item,
            n
        );
    } else {
        db.run(
            `INSERT INTO inventory(user_id, item_id, qty) VALUES(?, ?, ?)
             ON CONFLICT(user_id, item_id) DO UPDATE SET qty = qty + excluded.qty`,
            String(userId),
            item,
            n
        );
    }
    return true;
}

async function grantItem(id, itemId, qty = 1, scope = GLOBAL_SCOPE) {
    getUser(id, scope);
    return grantItemSync(id, itemId, qty, scope);
}

function promoteJobSync(userId, steps, scope) {
    const w = walletRef(scope, userId);
    const row = db.get(`SELECT job FROM ${w.table} WHERE ${w.where}`, ...w.keys);
    const idx = JOBS.findIndex(job => job.id === row?.job);
    const start = idx < 0 ? 0 : idx;
    const next = JOBS[Math.min(JOBS.length - 1, start + Math.max(1, moneyInt(steps, 1) || 1))];
    db.run(`UPDATE ${w.table} SET job = ? WHERE ${w.where}`, next.id, ...w.keys);
    return next;
}

function boostBusinessSync(userId, type, percent, scope) {
    const bump = Math.max(1, Math.min(500, moneyInt(percent, 10) || 10));
    const kind = cleanItemId(type);
    if (kind) {
        const ref = bizRef(scope, userId, kind);
        const row = db.get(`SELECT type FROM ${ref.table} WHERE ${ref.where}`, ...ref.keys);
        if (!row) {
            return null;
        }
        db.run(`UPDATE ${ref.table} SET boost = boost + ? WHERE ${ref.where}`, bump, ...ref.keys);
        return kind;
    }
    const ref = bizRef(scope, userId, "");
    const row = db.get(
        `SELECT type FROM ${ref.table} WHERE ${ref.listWhere} ORDER BY type LIMIT 1`,
        ...ref.listKeys
    );
    if (!row) {
        return null;
    }
    const target = bizRef(scope, userId, row.type);
    db.run(`UPDATE ${target.table} SET boost = boost + ? WHERE ${target.where}`, bump, ...target.keys);
    return row.type;
}

function applyDropSync(userId, drop, amount, scope) {
    const extras = {};
    if (!drop || drop.kind === "coins") {
        const coins = moneyInt(amount);
        if (coins > 0) {
            cashAdd(userId, coins, scope);
        }
        extras.amount = coins;
        return extras;
    }
    if (drop.kind === "job_xp") {
        extras.job = promoteJobSync(userId, drop.steps, scope);
        return extras;
    }
    if (drop.kind === "biz_boost") {
        extras.biz = boostBusinessSync(userId, drop.type, drop.percent, scope);
        extras.percent = Math.max(1, moneyInt(drop.percent, 10) || 10);
        return extras;
    }
    if (drop.kind === "box" || drop.kind === "item") {
        const itemId = drop.kind === "box" ? drop.boxId : drop.itemId;
        const qty = Math.max(1, moneyInt(drop.qty, 1) || 1);
        grantItemSync(userId, itemId, qty, scope);
        extras.itemId = itemId;
        extras.qty = qty;
        return extras;
    }
    if (drop.kind === "role") {
        extras.role = {
            hex: isHexColor(drop.hex) ? drop.hex : "",
            name: String(drop.name || "Цветная роль").slice(0, 100)
        };
        return extras;
    }
    return extras;
}

function asBoxRow(row, drops) {
    return {
        id: row.id,
        name: row.name,
        emoji: row.emoji || "📦",
        description: row.description || "",
        scope: row.scope,
        drops: (drops || []).map(item => asDrop(item))
    };
}

function loadBoxDef(itemId, scope) {
    const item = cleanItemId(itemId);
    if (!item) {
        return null;
    }
    const sid = normScope(scope);
    let row = isGuildScope(sid)
        ? db.get("SELECT * FROM boxes WHERE scope = ? AND id = ?", sid, item)
        : null;
    if (!row) {
        row = db.get("SELECT * FROM boxes WHERE scope = ? AND id = ?", GLOBAL_SCOPE, item);
    }
    if (!row) {
        return getBox(item);
    }
    const drops = db.all(
        "SELECT * FROM box_drops WHERE scope = ? AND box_id = ? ORDER BY id",
        row.scope,
        row.id
    );
    return asBoxRow(row, drops);
}

async function listBoxes(scope = GLOBAL_SCOPE) {
    const sid = scope == null || scope === "" ? GLOBAL_SCOPE : String(scope);
    const boxes = db.all("SELECT * FROM boxes WHERE scope = ? ORDER BY name", sid);
    const drops = db.all("SELECT * FROM box_drops WHERE scope = ? ORDER BY id", sid);
    const byBox = new Map();
    for (const drop of drops) {
        const list = byBox.get(drop.box_id) || [];
        list.push(drop);
        byBox.set(drop.box_id, list);
    }
    return boxes.map(row => asBoxRow(row, byBox.get(row.id) || []));
}

async function getBoxDef(scope, id) {
    return loadBoxDef(id, scope);
}

async function saveBox(scope, item) {
    const id = cleanItemId(item.id);
    const name = String(item.name ?? "").trim().slice(0, 64);
    if (!id || !name) {
        return { ok: false, reason: "invalid" };
    }
    db.run(
        `INSERT INTO boxes(scope, id, name, emoji, description) VALUES(?, ?, ?, ?, ?)
         ON CONFLICT(scope, id) DO UPDATE SET
            name = excluded.name,
            emoji = excluded.emoji,
            description = excluded.description`,
        String(scope),
        id,
        name,
        String(item.emoji ?? "").slice(0, 16),
        String(item.description ?? "").slice(0, 240)
    );
    return { ok: true, id };
}

async function deleteBox(scope, id) {
    const item = cleanItemId(id);
    db.run("DELETE FROM box_drops WHERE scope = ? AND box_id = ?", String(scope), item);
    const result = db.run("DELETE FROM boxes WHERE scope = ? AND id = ?", String(scope), item);
    return result.changes > 0;
}

async function saveDrop(scope, boxId, drop) {
    const box = cleanItemId(boxId || drop.boxId);
    if (!box) {
        return { ok: false, reason: "invalid" };
    }
    const exists = db.get("SELECT id FROM boxes WHERE scope = ? AND id = ?", String(scope), box);
    if (!exists) {
        return { ok: false, reason: "missing" };
    }
    const kind = String(drop.kind || "coins").slice(0, 16);
    const weight = Math.max(1, moneyInt(drop.weight, 1) || 1);
    const extra = JSON.stringify(dropExtra({ ...drop, hex: cleanHex(drop.hex) || String(drop.hex || "") }));
    if (drop.id) {
        db.run(
            "UPDATE box_drops SET kind = ?, weight = ?, extra = ? WHERE id = ? AND scope = ? AND box_id = ?",
            kind,
            weight,
            extra,
            Number(drop.id),
            String(scope),
            box
        );
    } else {
        db.run(
            "INSERT INTO box_drops(scope, box_id, kind, weight, extra) VALUES(?, ?, ?, ?, ?)",
            String(scope),
            box,
            kind,
            weight,
            extra
        );
    }
    return { ok: true, boxId: box };
}

async function deleteDrop(scope, dropId) {
    const result = db.run(
        "DELETE FROM box_drops WHERE scope = ? AND id = ?",
        String(scope),
        Number(dropId)
    );
    return result.changes > 0;
}

function applyAutomodFine(id, amount, scope = GLOBAL_SCOPE) {
    const fine = moneyInt(amount);
    if (fine < 1) {
        return { ok: false, taken: 0 };
    }
    getUser(id, scope);
    const w = walletRef(scope, id);
    return withTransaction(() => {
        const row = db.get(
            `SELECT balance FROM ${w.table} WHERE ${w.where}`,
            ...w.keys
        );
        const cash = Math.max(0, Number(row?.balance) || 0);
        const taken = Math.min(fine, cash);
        if (taken < 1) {
            return { ok: false, taken: 0 };
        }
        db.run(
            `UPDATE ${w.table} SET balance = balance - ? WHERE ${w.where} AND balance >= ?`,
            taken,
            ...w.keys,
            taken
        );
        return { ok: true, taken };
    });
}

async function openBox(id, itemId, payout, scope = GLOBAL_SCOPE) {
    const userId = String(id);
    const item = cleanItemId(itemId);
    if (!item) {
        return { ok: false, reason: "invalid" };
    }

    let options = {};
    let amount = null;
    if (payout && typeof payout === "object") {
        options = payout;
        scope = options.scope || scope;
        if (options.payout != null) {
            amount = moneyInt(options.payout);
        }
    } else if (arguments.length >= 3 && payout != null && payout !== "") {
        amount = Math.max(0, Math.floor(Number(payout) || 0));
        if (!Number.isFinite(amount)) {
            amount = 0;
        }
    }

    getUser(userId, scope);
    const box = loadBoxDef(item, scope);
    const random = typeof options.random === "function" ? options.random : Math.random;
    const sid = normScope(scope);

    if (amount == null && !box) {
        return { ok: false, reason: "invalid" };
    }

    return withTransaction(() => {
        if (!consumeQty(userId, item, 1, sid)) {
            return { ok: false, reason: "missing" };
        }
        if (amount != null) {
            if (amount > 0) {
                cashAdd(userId, amount, scope);
            }
            return { ok: true, amount, jackpot: false, drop: amount ? { kind: "coins" } : null, box };
        }
        const loot = roll(box, random);
        const extras = applyDropSync(userId, loot.drop, loot.amount, scope);
        return {
            ok: true,
            amount: loot.amount || extras.amount || 0,
            jackpot: Boolean(loot.jackpot),
            drop: loot.drop,
            extras,
            box
        };
    });
}

module.exports = {
    initDatabase,
    closeDatabase,
    resolveDatabasePath,
    GLOBAL_SCOPE,
    getUser,
    addXp,
    addXpBatch,
    addBalance,
    removeBalance,
    setBalance,
    cashSpend,
    cashAdd,
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
    STAFF_RANK,
    isStaff,
    getStaffRank,
    addStaff,
    removeStaff,
    listStaff,
    getGuildStaffRank,
    addGuildStaff,
    removeGuildStaff,
    listGuildStaff,
    listGuildStaffForUser,
    SESSION_TTL,
    saveWebSession,
    getWebSession,
    deleteWebSession,
    getGuildEvent,
    saveGuildEvent,
    listGuildEvents,
    listShopItems,
    listShop,
    getShopItem,
    findShopItem,
    saveShopItem,
    deleteShopItem,
    setWallet,
    setUser,
    resetCooldowns,
    deleteUser,
    setInventoryItem,
    searchUsers,
    touchProfile,
    setJob,
    isPrefixEnabled,
    setPrefixEnabled,
    getGuildSettings,
    saveGuildSettings,
    warmGuildCache,
    applyAutomodFine,
    listCustomCommands,
    getCustomCommand,
    saveCustomCommand,
    deleteCustomCommand,
    neededXp,
    getKv,
    setKv,
    btcPrice,
    buyBtc,
    sellBtc,
    getBusiness,
    listBusinesses,
    buyBusiness,
    upgradeBusiness,
    collectBusiness,
    peekBusiness,
    restartBusiness,
    restartFee,
    pendingBusinessIncome,
    applyIdlePenalties,
    snapshot,
    listCatalog,
    saveCatalogItem,
    deleteCatalogItem,
    consumeItem,
    grantItem,
    listBoxes,
    getBoxDef,
    saveBox,
    deleteBox,
    saveDrop,
    deleteDrop,
    openBox
};
