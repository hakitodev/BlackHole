const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");
const economy = require("../Database/Economy");
const { BUSINESSES, byQuery, upgradeCost, incomePerMin } = require("../Utils/business");
const { reply, error, COLOR } = require("../Utils/reply");

function line(def, biz) {
    const level = biz?.level || 1;
    const wait = biz ? ` · накоплено **${biz.unclaimed}** / ${def.cap * level}` : "";
    const own = biz ? `ур. **${level}** · ${Math.floor(incomePerMin(def, level))}/мин${wait}` : `цена **${def.price}**`;
    return `${def.emoji} **${def.name}** — ${own}`;
}

function bizButtons(owned) {
    const row = new ActionRowBuilder();
    if (owned.length) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId("biz_collect")
                .setLabel("Забрать")
                .setStyle(ButtonStyle.Success)
        );
    }
    return row.components.length ? [row] : [];
}

async function snapshot(userId) {
    const now = Date.now();
    const lines = [];
    const owned = [];
    for (const def of BUSINESSES) {
        const biz = await economy.peekBusiness(userId, def.id, def, now);
        if (biz) {
            owned.push({ def, biz });
        }
        lines.push(line(def, biz));
    }
    return { lines, owned };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("biz")
        .setDescription("Бизнес")
        .addSubcommand(sub => sub.setName("list").setDescription("Список"))
        .addSubcommand(sub =>
            sub
                .setName("buy")
                .setDescription("Купить")
                .addStringOption(option =>
                    option.setName("type").setDescription("Какой").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("upgrade")
                .setDescription("Прокачать")
                .addStringOption(option =>
                    option.setName("type").setDescription("Какой").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("collect")
                .setDescription("Забрать прибыль")
                .addStringOption(option =>
                    option.setName("type").setDescription("Какой, пусто — все")
                )
        ),
    aliases: ["business", "бизнес"],

    async execute(interaction) {
        const sub = interaction.options.getSubcommand(false) || "list";
        const userId = interaction.user.id;

        if (sub === "buy") {
            const def = byQuery(interaction.options.getString("type"));
            if (!def) {
                return error(interaction, "Нет такого бизнеса.");
            }
            const result = await economy.buyBusiness(userId, def.id, def);
            if (result.reason === "owned") {
                return error(interaction, "Уже есть.");
            }
            if (!result.ok) {
                return error(interaction, `Нужно **${def.price}**.`);
            }
            return reply(interaction, {
                color: COLOR.green,
                description: `Купил ${def.emoji} **${def.name}**. Забирай через \`/biz collect\`.`
            });
        }

        if (sub === "upgrade") {
            const def = byQuery(interaction.options.getString("type"));
            if (!def) {
                return error(interaction, "Нет такого бизнеса.");
            }
            const current = await economy.getBusiness(userId, def.id);
            const result = await economy.upgradeBusiness(userId, def.id, def);
            if (result.reason === "missing") {
                return error(interaction, "Сначала купи.");
            }
            if (result.reason === "max") {
                return error(interaction, "Максимум.");
            }
            if (!result.ok) {
                return error(interaction, `Нужно **${upgradeCost(def, current?.level || 1)}**.`);
            }
            return reply(interaction, {
                color: COLOR.green,
                description: `${def.emoji} **${def.name}** теперь ур. **${result.level}**. −**${result.cost}**`
            });
        }

        if (sub === "collect") {
            const query = interaction.options.getString("type");
            const targets = query
                ? [byQuery(query)].filter(Boolean)
                : BUSINESSES;
            if (query && !targets.length) {
                return error(interaction, "Нет такого бизнеса.");
            }

            const parts = [];
            let total = 0;
            for (const def of targets) {
                const result = await economy.collectBusiness(userId, def.id, def);
                if (result.ok) {
                    parts.push(`${def.emoji} **${def.name}** +**${result.amount}**`);
                    total += result.amount;
                }
            }
            if (!parts.length) {
                return error(interaction, "Пока нечего забирать.");
            }
            return reply(interaction, {
                color: COLOR.gold,
                description: `${parts.join("\n")}\nИтого **${total}**`
            });
        }

        const snap = await snapshot(userId);
        const message = await reply(interaction, {
            color: COLOR.gold,
            title: "Бизнес",
            description: snap.lines.join("\n"),
            components: bizButtons(snap.owned),
            fetchReply: true
        }).catch(() => null);

        if (!snap.owned.length) {
            return;
        }

        const collector = (interaction.channel || message)?.createMessageComponentCollector?.({
            time: 20000,
            filter: i => i.user.id === interaction.user.id && i.customId === "biz_collect"
        });

        if (!collector) {
            return;
        }

        collector.on("collect", async i => {
            const parts = [];
            let total = 0;
            for (const { def } of snap.owned) {
                const result = await economy.collectBusiness(userId, def.id, def);
                if (result.ok) {
                    parts.push(`${def.emoji} **${def.name}** +**${result.amount}**`);
                    total += result.amount;
                }
            }
            collector.stop("opened");
            await i.update({
                embeds: [{
                    color: COLOR.gold,
                    description: parts.length ? `${parts.join("\n")}\nИтого **${total}**` : "Пока нечего забирать."
                }],
                components: []
            }).catch(() => {});
        });

        collector.on("end", async (_, reason) => {
            if (reason === "opened") {
                return;
            }
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ components: [] }).catch(() => {});
            }
        });
    }
};
