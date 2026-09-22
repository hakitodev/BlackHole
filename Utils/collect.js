const economy = require("../Database/Economy");
const { integer, pick } = require("./random");
const { formatDuration } = require("./time");

const DAILY_REWARD = 100 + integer(200, 1000);
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

async function runCollect(userId, random = Math.random) {
    const parts = [];
    let level = null;

    const daily = await economy.claimDaily(userId, DAILY_REWARD, DAILY_COOLDOWN);
    if (daily.ok) {
        parts.push({ id: "daily", ok: true, amount: daily.amount });
        if (daily.leveled) {
            level = daily.level;
        }
    } else {
        parts.push({ id: "daily", ok: false, nextAt: daily.nextAt });
    }

    const job = pick(JOBS);
    const workPay = integer(job.min, job.max);
    const work = await economy.claimWork(userId, workPay, WORK_COOLDOWN);
    if (work.ok) {
        parts.push({ id: "work", ok: true, amount: work.amount, text: job.text });
        if (work.leveled) {
            level = work.level;
        }
    } else {
        parts.push({ id: "work", ok: false, nextAt: work.nextAt });
    }

    const crimeSuccess = random() < 0.55;
    const crimePay = integer(180, 480);
    const crimeFine = integer(80, 220);
    const action = pick(CRIMES);
    const crime = await economy.commitCrime(
        userId,
        CRIME_COOLDOWN,
        crimeSuccess,
        crimePay,
        crimeFine
    );

    if (!crime.ok) {
        parts.push({ id: "crime", ok: false, nextAt: crime.nextAt });
    } else if (crime.success) {
        parts.push({
            id: "crime",
            ok: true,
            success: true,
            amount: crime.amount,
            text: action
        });
        if (crime.leveled) {
            level = crime.level;
        }
    } else {
        parts.push({
            id: "crime",
            ok: true,
            success: false,
            wiped: Boolean(crime.wiped),
            amount: crime.amount,
            text: action
        });
    }

    const claimed = parts.some(part => part.ok);
    const after = await economy.getUser(userId);

    return { parts, claimed, level, balance: after.balance };
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
    DAILY_REWARD,
    DAILY_COOLDOWN,
    WORK_COOLDOWN,
    CRIME_COOLDOWN,
    JOBS,
    CRIMES,
    runCollect,
    formatCollect
};
