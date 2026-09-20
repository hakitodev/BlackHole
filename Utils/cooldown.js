const buckets = new Map();

function remaining(key) {
    const until = buckets.get(key) ?? 0;
    return Math.max(0, until - Date.now());
}

function hit(key, ms) {
    buckets.set(key, Date.now() + ms);
}

function formatSeconds(ms) {
    return Math.max(1, Math.ceil(ms / 1000));
}

module.exports = {
    remaining,
    hit,
    formatSeconds
};
