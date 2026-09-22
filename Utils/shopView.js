const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require("discord.js");
const economy = require("../Database/Economy");

function normalizeShopScope(value) {
    const raw = String(value ?? "global").toLowerCase();
    if (["guild", "server", "сервер", "local", "гильдия"].includes(raw)) {
        return "guild";
    }
    return "global";
}

function parseShopId(customId) {
    const parts = String(customId).split("_");
    return {
        scope: normalizeShopScope(parts[1])
    };
}

function block(items) {
    if (!items.length) {
        return "пусто";
    }
    return items.map(item =>
        `${item.emoji} **${item.name}** — ${item.price}\n${item.description}`
    ).join("\n\n");
}

function buttons(scope, hasGuild) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("shop_global")
            .setLabel("Всемирный")
            .setStyle(scope === "global" ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(scope === "global"),
        new ButtonBuilder()
            .setCustomId("shop_guild")
            .setLabel("Сервер")
            .setStyle(scope === "guild" ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(scope === "guild" || !hasGuild)
    );
}

async function buildShopMessage(guildId, scope) {
    const hasGuild = Boolean(guildId);
    const view = hasGuild ? normalizeShopScope(scope) : "global";
    const items = view === "guild" && hasGuild
        ? await economy.listShopItems(guildId)
        : await economy.listShopItems("global");

    const embed = new EmbedBuilder()
        .setColor(0xEB459E)
        .setTitle(view === "guild" ? "Магазин сервера" : "Всемирный магазин")
        .setDescription(block(items).slice(0, 4000));

    return {
        embeds: [embed],
        components: [buttons(view, hasGuild)]
    };
}

module.exports = {
    normalizeShopScope,
    parseShopId,
    buildShopMessage
};
