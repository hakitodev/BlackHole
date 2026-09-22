const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require("discord.js");
const economy = require("../Database/Economy");
const { byQuery, mergeBoxes, formatDrop } = require("../Utils/boxes");
const { forInteraction } = require("../Utils/scope");
const { isHexColor, parseColor } = require("../Utils/color");
const { reply, error, COLOR } = require("../Utils/reply");

function boxButtons(boxes) {
    return new ActionRowBuilder().addComponents(
        boxes.slice(0, 5).map(box =>
            new ButtonBuilder()
                .setCustomId(`box_${box.id}`)
                .setLabel(box.name)
                .setStyle(ButtonStyle.Secondary)
        )
    );
}

async function catalog(guildId, settings) {
    const globalOn = settings?.shopGlobal !== false;
    const guildOn = Boolean(guildId) && settings?.shopGuild !== false;
    const [globalBoxes, guildBoxes] = await Promise.all([
        globalOn ? economy.listBoxes("global") : [],
        guildOn ? economy.listBoxes(guildId) : []
    ]);
    return mergeBoxes(globalBoxes, guildBoxes);
}

async function giveRole(interaction, pending) {
    if (!pending?.hex || !isHexColor(pending.hex)) {
        return { ok: false, text: "В дропе нет цвета роли." };
    }
    if (!interaction.guild) {
        return { ok: false, text: "Роль только на сервере." };
    }
    const me = interaction.guild.members.me;
    if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
        return { ok: false, text: "Боту нужны права на роли." };
    }
    const color = parseColor(pending.hex, null);
    if (color == null) {
        return { ok: false, text: "Цвет роли битый." };
    }
    try {
        const role = await interaction.guild.roles.create({
            name: String(pending.name || "Цветная роль").slice(0, 100),
            color,
            reason: `box ${interaction.user.id}`
        });
        await interaction.member.roles.add(role);
        return { ok: true, text: `роль **${role.name}**` };
    } catch {
        return { ok: false, text: "Не вышло выдать роль." };
    }
}

function lootText(result) {
    if (!result.ok) {
        return "Нет такого бокса.";
    }
    const box = result.box || {};
    const extras = result.extras || {};
    if (extras.role) {
        return extras.roleText
            ? `Открыл ${box.emoji || "📦"} **${box.name || "бокс"}** — ${extras.roleText}`
            : `Открыл ${box.emoji || "📦"} **${box.name || "бокс"}** — роль.`;
    }
    const jackpot = result.jackpot ? " Джекпот." : "";
    return `Открыл ${box.emoji || "📦"} **${box.name || "бокс"}** — ${formatDrop(result.drop, {
        amount: result.amount,
        job: extras.job?.name,
        biz: extras.biz
    })}.${jackpot}`;
}

async function openOwned(interaction, userId, box, scope) {
    const result = await economy.openBox(userId, box.id, null, scope);
    if (!result.ok) {
        return result;
    }
    result.box = result.box || box;
    const pending = result.extras?.role;
    if (pending) {
        const given = await giveRole(interaction, pending);
        if (!given.ok) {
            await economy.grantItem(userId, box.id, 1, scope);
            return { ok: false, reason: "role", text: given.text };
        }
        result.extras.roleText = given.text;
    }
    return result;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("box")
        .setDescription("Боксы")
        .addSubcommand(sub =>
            sub
                .setName("open")
                .setDescription("Открыть")
                .addStringOption(option =>
                    option.setName("item").setDescription("Какой бокс")
                )
        ),
    aliases: ["case", "lootbox"],

    async execute(interaction) {
        const { scope, settings } = await forInteraction(interaction);
        const query = interaction.options.getString("item");
        const boxes = await catalog(interaction.guildId, settings);
        const inv = await economy.getInventory(interaction.user.id, scope);
        const owned = new Map(inv.map(row => [row.item_id, row.qty]));
        const have = boxes.filter(box => owned.get(box.id) > 0);

        const open = async box => {
            const result = await openOwned(interaction, interaction.user.id, box, scope);
            if (!result.ok) {
                return error(interaction, result.text || "Нет такого бокса.");
            }
            return reply(interaction, {
                color: result.jackpot ? COLOR.gold : COLOR.pink,
                description: lootText(result)
            });
        };

        if (query) {
            const box = byQuery(query, boxes) || byQuery(query);
            if (!box) {
                return error(interaction, "Такого бокса нет.");
            }
            return open(box);
        }

        if (!have.length) {
            return error(interaction, "Боксов нет. Купи в `/shop`.");
        }

        if (have.length === 1) {
            return open(have[0]);
        }

        const message = await reply(interaction, {
            color: COLOR.pink,
            title: "Боксы",
            description: have.map(box => `${box.emoji} **${box.name}** × **${owned.get(box.id)}**`).join("\n"),
            components: [boxButtons(have)],
            fetchReply: true
        }).catch(() => null);

        const sent = message || interaction;
        const collector = (interaction.channel || sent)?.createMessageComponentCollector?.({
            time: 20000,
            filter: i => i.user.id === interaction.user.id && String(i.customId).startsWith("box_")
        });

        if (!collector) {
            return;
        }

        collector.on("collect", async i => {
            const box = byQuery(String(i.customId).slice(4), boxes) || byQuery(String(i.customId).slice(4));
            if (!box) {
                await i.deferUpdate().catch(() => {});
                return;
            }
            const result = await openOwned(interaction, interaction.user.id, box, scope);
            collector.stop("opened");
            await i.update({
                embeds: [{
                    color: result.ok ? COLOR.pink : COLOR.red,
                    description: result.ok ? lootText(result) : (result.text || "Нет такого бокса.")
                }],
                components: []
            }).catch(() => {});
        });

        collector.on("end", async (_, reason) => {
            if (reason === "opened") {
                return;
            }
            const payload = {
                components: []
            };
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply(payload).catch(() => {});
            }
        });
    }
};
