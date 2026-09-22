const economy = require("../Database/Economy");

function displayName(user) {
    return user?.globalName || user?.global_name || user?.displayName || user?.username || "";
}

async function remember(user) {
    if (!user?.id) {
        return;
    }

    const username = displayName(user);
    const avatar = user.avatar || "";
    if (!username && !avatar) {
        return;
    }

    await economy.touchProfile(user.id, { username, avatar }).catch(() => {});
}

async function enrichUsers(client, users) {
    const list = Array.isArray(users) ? users : [];
    for (const row of list) {
        if (row.username) {
            continue;
        }
        const cached = client?.users?.cache?.get(row.id);
        if (cached) {
            await remember(cached);
            row.username = displayName(cached);
            continue;
        }
        if (client?.users?.fetch && /^\d{17,20}$/.test(row.id)) {
            const fetched = await client.users.fetch(row.id).catch(() => null);
            if (fetched) {
                await remember(fetched);
                row.username = displayName(fetched);
            }
        }
    }
    return list;
}

async function lookupDiscord(client, id) {
    if (!client?.users || !/^\d{17,20}$/.test(String(id || ""))) {
        return null;
    }
    const cached = client.users.cache?.get(String(id));
    if (cached) {
        await remember(cached);
        return cached;
    }
    const fetched = await client.users.fetch(String(id)).catch(() => null);
    if (fetched) {
        await remember(fetched);
    }
    return fetched;
}

module.exports = {
    displayName,
    remember,
    enrichUsers,
    lookupDiscord
};
