const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require("discord.js");
const economy = require("../Database/Economy");

const PAGE_SIZE = 10;

function normalizeTopType(value) {
    const raw = String(value ?? "money").toLowerCase();

    if (["level", "lvl", "xp", "ур", "уровень"].includes(raw)) {
        return "level";
    }

    return "money";
}

function parseTopId(customId) {
    const parts = String(customId).split("_");
    return {
        action: parts[1] ?? "page",
        type: normalizeTopType(parts[2]),
        page: Math.max(0, Number(parts[3]) || 0)
    };
}

function pageCount(total) {
    return Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
}

function nextState(action, type, page, total) {
    const pages = pageCount(total);

    if (action === "type") {
        return {
            type: type === "money" ? "level" : "money",
            page: 0
        };
    }

    let next = page;
    if (action === "next") {
        next += 1;
    }
    if (action === "prev") {
        next -= 1;
    }

    return {
        type,
        page: Math.max(0, Math.min(pages - 1, next))
    };
}

function formatLines(users, type, offset) {
    return users.map((user, index) => {
        const rank = offset + index + 1;

        if (type === "level") {
            return `**${rank}.** <@${user.id}> — ур. **${user.level}**`;
        }

        const total = (Number(user.balance) || 0) + (Number(user.bank) || 0);
        return `**${rank}.** <@${user.id}> — **${total}**`;
    });
}

function buttons(type, page, total) {
    const pages = pageCount(total);

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`top_prev_${type}_${page}`)
            .setLabel("◀")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 0),
        new ButtonBuilder()
            .setCustomId(`top_type_${type}_${page}`)
            .setLabel(type === "money" ? "Уровень" : "Деньги")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`top_next_${type}_${page}`)
            .setLabel("▶")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= pages - 1)
    );
}

async function buildTopMessage(type, page) {
    const total = await economy.countUsers();

    if (!total) {
        return null;
    }

    const state = nextState("page", type, page, total);
    const offset = state.page * PAGE_SIZE;
    const users = await economy.getTop(PAGE_SIZE, state.type, offset);
    const pages = pageCount(total);
    const lines = formatLines(users, state.type, offset);

    const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(state.type === "level" ? "Топ по уровню" : "Топ")
        .setDescription(lines.join("\n") || "Пока некого показывать.")
        .setFooter({ text: `${state.page + 1}/${pages}` });

    return {
        embeds: [embed],
        components: [buttons(state.type, state.page, total)]
    };
}

module.exports = {
    PAGE_SIZE,
    normalizeTopType,
    parseTopId,
    pageCount,
    nextState,
    buildTopMessage
};
