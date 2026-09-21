const { OWNER_ID } = require("../Config");
const economy = require("../Database/Economy");

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

    await interaction.reply({
        content: "Только владелец бота может назначать модераторов.",
        ephemeral: true
    });
    return false;
}

async function requireStaff(interaction) {
    if (await isStaff(interaction)) {
        return true;
    }

    await interaction.reply({
        content: "Нужно быть владельцем или модератором экономики.",
        ephemeral: true
    });
    return false;
}

module.exports = {
    ownerIds,
    isOwner,
    isStaff,
    requireOwner,
    requireStaff
};
