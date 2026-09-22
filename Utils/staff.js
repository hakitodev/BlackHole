const { OWNER_ID } = require("../Config");
const economy = require("../Database/Economy");
const { error } = require("./reply");

function ownerIds(client) {
    const ids = new Set();

    if (OWNER_ID) {
        ids.add(String(OWNER_ID));
    }

    const owner = client.application?.owner;
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
    return ownerIds(interaction.client).has(interaction.user.id);
}

async function isStaff(interaction) {
    if (isOwner(interaction)) {
        return true;
    }

    return economy.isStaff(interaction.user.id);
}

async function requireOwner(interaction) {
    if (isOwner(interaction)) {
        return true;
    }

    await error(interaction, "Только владелец бота может назначать модераторов.");
    return false;
}

async function requireStaff(interaction) {
    if (await isStaff(interaction)) {
        return true;
    }

    await error(interaction, "Нужно быть владельцем или модератором.");
    return false;
}

module.exports = {
    ownerIds,
    isOwner,
    isStaff,
    requireOwner,
    requireStaff
};
