const { OWNER_ID } = require("../Config");
const economy = require("../Database/Economy");
const { error } = require("./reply");

const RANK = {
    none: 0,
    mod: 1,
    senior: 2,
    owner: 3
};

function rankLabel(rank) {
    if (rank >= RANK.owner) {
        return "владелец";
    }
    if (rank >= RANK.senior) {
        return "высший модератор";
    }
    if (rank >= RANK.mod) {
        return "модератор";
    }
    return "нет";
}

function ownerIds(client) {
    const ids = new Set();

    if (OWNER_ID) {
        ids.add(String(OWNER_ID));
    }

    const owner = client?.application?.owner;
    if (!owner) {
        return ids;
    }

    if (owner.members) {
        if (owner.ownerId) {
            ids.add(String(owner.ownerId));
        }

        for (const member of owner.members.values()) {
            ids.add(String(member.user?.id ?? member.id));
        }

        return ids;
    }

    if (owner.id) {
        ids.add(String(owner.id));
    }

    return ids;
}

function isOwner(interaction) {
    return ownerIds(interaction.client).has(String(interaction.user.id));
}

async function staffRank(userId, client) {
    if (client && ownerIds(client).has(String(userId))) {
        return RANK.owner;
    }
    const stored = await economy.getStaffRank(userId);
    return stored >= RANK.senior ? RANK.senior : stored >= RANK.mod ? RANK.mod : RANK.none;
}

async function getRank(interaction) {
    return staffRank(interaction.user.id, interaction.client);
}

async function isStaff(interaction) {
    return (await getRank(interaction)) >= RANK.mod;
}

async function isSenior(interaction) {
    return (await getRank(interaction)) >= RANK.senior;
}

async function isBotAdmin(userId, client) {
    return (await staffRank(userId, client)) >= RANK.senior;
}

async function requireOwner(interaction) {
    if (isOwner(interaction)) {
        return true;
    }

    await error(interaction, "Только владелец бота.");
    return false;
}

async function requireStaff(interaction) {
    if (await isStaff(interaction)) {
        return true;
    }

    await error(interaction, "Нужно быть владельцем или модератором.");
    return false;
}

async function requireSenior(interaction) {
    if (await isSenior(interaction)) {
        return true;
    }

    await error(interaction, "Только высший модератор или владелец.");
    return false;
}

module.exports = {
    RANK,
    rankLabel,
    ownerIds,
    isOwner,
    staffRank,
    getRank,
    isStaff,
    isSenior,
    isBotAdmin,
    requireOwner,
    requireStaff,
    requireSenior
};
