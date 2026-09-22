const SAFE_MAX = Number.MAX_SAFE_INTEGER;
const FLIP_MAX_BET = 25000;
const ROB_MAX_STEAL = 15000;
const PAY_MAX = 1_000_000_000;
const BTC_MAX_COINS = 10000;
const DAY_MS = 24 * 60 * 60 * 1000;
const JOB_IDLE_MS = 36 * 60 * 60 * 1000;
const BIZ_IDLE_MS = DAY_MS;

function moneyInt(value, fallback = 0) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 0 || n > SAFE_MAX) {
        return fallback;
    }
    return n;
}

function clampGuildCap(value, systemMax) {
    const n = moneyInt(value, systemMax);
    if (n < 1) {
        return systemMax;
    }
    return Math.min(n, systemMax);
}

module.exports = {
    SAFE_MAX,
    FLIP_MAX_BET,
    ROB_MAX_STEAL,
    PAY_MAX,
    BTC_MAX_COINS,
    DAY_MS,
    JOB_IDLE_MS,
    BIZ_IDLE_MS,
    moneyInt,
    clampGuildCap
};
