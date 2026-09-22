const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");
const economy = require("../Database/Economy");
const { BOXES, byQuery, roll } = require("../Utils/boxes");
const { reply, error, COLOR } = require("../Utils/reply");

function boxButtons(owned) {
    return new ActionRowBuilder().addComponents(
        BOXES.map(box =>
            new ButtonBuilder()
                .setCustomId(`box_${box.id}`)
                .setLabel(box.name)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!owned.has(box.id))
        )
    );
}

async function openOwned(userId, box, random) {
    const loot = roll(box, random);
    return economy.openBox(userId, box.id, loot.amount).then(result => ({ ...result, ...loot, box }));
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
        const query = interaction.options.getString("item");
        const inv = await economy.getInventory(interaction.user.id);
        const owned = new Map(inv.map(row => [row.item_id, row.qty]));
        const have = BOXES.filter(box => owned.get(box.id) > 0);

        const open = async box => {
            const result = await openOwned(interaction.user.id, box);
            if (!result.ok) {
                return error(interaction, "Нет такого бокса.");
            }
            const jackpot = result.jackpot ? " Джекпот." : "";
            return reply(interaction, {
                color: result.jackpot ? COLOR.gold : COLOR.pink,
                description: `Открыл ${box.emoji} **${box.name}** — **+${result.amount}**.${jackpot}`
            });
        };

        if (query) {
            const box = byQuery(query);
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
            components: [boxButtons(new Set(have.map(box => box.id)))],
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
            const box = byQuery(String(i.customId).slice(4));
            if (!box) {
                await i.deferUpdate().catch(() => {});
                return;
            }
            const result = await openOwned(interaction.user.id, box);
            collector.stop("opened");
            const jackpot = result.ok && result.jackpot ? " Джекпот." : "";
            const text = result.ok
                ? `Открыл ${box.emoji} **${box.name}** — **+${result.amount}**.${jackpot}`
                : "Нет такого бокса.";
            await i.update({
                embeds: [{
                    color: result.ok ? COLOR.pink : COLOR.red,
                    description: text
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
