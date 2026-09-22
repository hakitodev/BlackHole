const JOBS = [
    { id: "intern", name: "Стажёр", minLevel: 1, mult: 1 },
    { id: "courier", name: "Курьер", minLevel: 3, mult: 1.2 },
    { id: "dev", name: "Разраб", minLevel: 8, mult: 1.5 },
    { id: "trader", name: "Трейдер", minLevel: 15, mult: 1.8 },
    { id: "boss", name: "Босс", minLevel: 25, mult: 2.2 }
];

const JOB_MAP = new Map(JOBS.map(job => [job.id, job]));

function getJob(id) {
    return JOB_MAP.get(String(id || "")) || JOBS[0];
}

function jobByQuery(query) {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) {
        return null;
    }
    return JOBS.find(job => job.id === q || job.name.toLowerCase() === q) || null;
}

function multiplier(jobId) {
    return getJob(jobId).mult;
}

function fromCatalog(row, fallback = {}) {
    return {
        id: row.id,
        name: row.name,
        minLevel: Math.max(1, Number(row.minLevel) || fallback.minLevel || 1),
        mult: Math.max(0.1, Number(row.mult) || fallback.mult || 1)
    };
}

function mergeJobs(globalOn, guildItems = []) {
    const map = new Map();
    if (globalOn !== false) {
        for (const job of JOBS) {
            map.set(job.id, job);
        }
    }
    for (const item of guildItems) {
        if (!item?.id) {
            continue;
        }
        map.set(item.id, fromCatalog(item));
    }
    return [...map.values()];
}

function getJobFrom(list, id) {
    return list.find(job => job.id === String(id || "")) || list[0] || JOBS[0];
}

function jobByQueryFrom(list, query) {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) {
        return null;
    }
    return list.find(job => job.id === q || job.name.toLowerCase() === q) || null;
}

module.exports = {
    JOBS,
    getJob,
    jobByQuery,
    multiplier,
    mergeJobs,
    getJobFrom,
    jobByQueryFrom
};
