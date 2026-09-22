function snowflake(value) {
    return String(value ?? "").replace(/\D/g, "").slice(0, 20);
}

function parseIdList(raw, max = 8) {
    const parts = Array.isArray(raw) ? raw : String(raw ?? "").split(/[,\s]+/);
    const ids = [];
    const seen = new Set();

    for (const part of parts) {
        const id = snowflake(part);
        if (!/^\d{17,20}$/.test(id) || seen.has(id)) {
            continue;
        }
        seen.add(id);
        ids.push(id);
        if (ids.length >= max) {
            break;
        }
    }

    return ids;
}

function asList(value) {
    if (value == null || value === "") {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

module.exports = {
    snowflake,
    parseIdList,
    asList
};
