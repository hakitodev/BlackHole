const economy = require("../Database/Economy");
const { integer, pick } = require("./random");
const { formatDuration } = require("./time");
const { multiplier, getJob } = require("./jobs");

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
const WORK_COOLDOWN = 45 * 60 * 1000;
const CRIME_COOLDOWN = 2 * 60 * 60 * 1000;

const JOBS = [
    { text: "отработал смену в магазине", min: 80, max: 180 },
    { text: "развёз заказы", min: 90, max: 200 },
    { text: "починил кому-то компьютер", min: 120, max: 260 },
    { text: "постоял на ресепшене", min: 70, max: 160 },
    { text: "наколол дрова кому-то", min: 70, max: 160 },
    { text: "помог с переездом", min: 110, max: 240 }
];

const CRIMES = [
    "ограбил ларёк",
    "взломал автомат",
    "утащил посылку",
    "стащил кошелек",
    "угнал велик",
    "угнал самокат",
    "снял магнитолу"
];

function dailyReward(settings) {
    return integer(settings?.dailyMin ?? 300, settings?.dailyMax ?? 1100);
}

function workRange(settings, jobId) {
    const min = settings?.workMin ?? 70;
    const max = Math.max(min, settings?.workMax ?? 260);
    const mult = multiplier(jobId);
    return {
        min: Math.max(1, Math.floor(min * mult)),
        max: Math.max(1, Math.floor(max * mult))
    };
}

async function runDaily(userId, settings, scope) {
    return economy.claimDaily(userId, dailyReward(settings), DAILY_COOLDOWN, 25, scope);
}

async function runWork(userId, settings, user, scope) {
    const shift = pick(JOBS);
    const range = workRange(settings, user?.job);
    const payout = integer(range.min, range.max);
    const work = await economy.claimWork(userId, payout, WORK_COOLDOWN, 15, scope);
    const job = getJob(user?.job);
    return { ...work, text: shift.text, job: job.name };
}

async function runCrime(userId, settings, random = Math.random, scope) {
    const success = random() < 0.55;
    const payout = integer(settings?.crimeMin ?? 180, settings?.crimeMax ?? 480);
    const fine = integer(settings?.crimeFineMin ?? 80, settings?.crimeFineMax ?? 220);
    const action = pick(CRIMES);
    const crime = await economy.commitCrime(
        userId,
        CRIME_COOLDOWN,
        success,
        payout,
        fine,
        20,
        scope
    );
    return { ...crime, text: action };
}

async function runCollect(userId, kind, options = {}) {
    const settings = options.settings || {};
    const random = options.random || Math.random;
    const scope = options.scope || "global";
    await economy.applyIdlePenalties(userId, scope, settings);
    const user = await economy.getUser(userId, scope);
    let part;

    if (kind === "daily") {
        const daily = await runDaily(userId, settings, scope);
        part = daily.ok
            ? { id: "daily", ok: true, amount: daily.amount, level: daily.level, leveled: daily.leveled }
            : { id: "daily", ok: false, nextAt: daily.nextAt };
    } else if (kind === "work") {
        const work = await runWork(userId, settings, user, scope);
        part = work.ok
            ? { id: "work", ok: true, amount: work.amount, text: work.text, job: work.job, level: work.level, leveled: work.leveled }
            : { id: "work", ok: false, nextAt: work.nextAt };
    } else if (kind === "crime") {
        const crime = await runCrime(userId, settings, random, scope);
        if (!crime.ok) {
            part = { id: "crime", ok: false, nextAt: crime.nextAt };
        } else if (crime.success) {
            part = {
                id: "crime",
                ok: true,
                success: true,
                amount: crime.amount,
                text: crime.text,
                level: crime.level,
                leveled: crime.leveled
            };
        } else {
            part = {
                id: "crime",
                ok: true,
                success: false,
                wiped: Boolean(crime.wiped),
                amount: crime.amount,
                text: crime.text
            };
        }
    } else {
        return { parts: [], claimed: false, level: null, balance: user.balance };
    }

    const after = await economy.getUser(userId, scope);
    return {
        parts: [part],
        claimed: Boolean(part.ok),
        level: part.leveled ? part.level : null,
        balance: after.balance
    };
}

function formatPart(part) {
    const wait = part.nextAt
        ? formatDuration(part.nextAt - Date.now())
        : "";

    if (part.id === "daily") {
        return part.ok
            ? `Ежедневка — **+${part.amount}**`
            : `Ежедневка — через ${wait}`;
    }

    if (part.id === "work") {
        return part.ok
            ? `Работа — ${part.text} · **+${part.amount}**`
            : `Работа — через ${wait}`;
    }

    if (!part.ok) {
        return `Преступление — через ${wait}`;
    }

    if (part.success) {
        return `Преступление — ${part.text} · **+${part.amount}**`;
    }

    if (part.wiped) {
        return `Преступление — ${part.text}, забрали все наличные`;
    }

    return `Преступление — ${part.text}, штраф **${part.amount}**`;
}

function formatCollect(result) {
    const levelUp = result.level ? `\nНовый уровень: **${result.level}**` : "";
    return `${result.parts.map(formatPart).join("\n")}${levelUp}`;
}

module.exports = {
    dailyReward,
    DAILY_COOLDOWN,
    WORK_COOLDOWN,
    CRIME_COOLDOWN,
    JOBS,
    CRIMES,
    runCollect,
    formatCollect
};
