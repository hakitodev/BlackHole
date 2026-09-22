const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { isOwner } = require("../Utils/staff");
const { getJob } = require("../Utils/jobs");
const { mergeBusinesses } = require("../Utils/business");
const { forInteraction } = require("../Utils/scope");
const { reply, COLOR } = require("../Utils/reply");

function bar(xp, need) {
    const size = 10;
    const filled = Math.max(0, Math.min(size, Math.round((xp / need) * size)));
    return "█".repeat(filled) + "░".repeat(size - filled);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profile")
        .setDescription("Профиль")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь или ответ на сообщение")
        ),
    aliases: ["rank", "level"],

    async execute(interaction) {
        const member = interaction.options.getUser("user") ?? interaction.user;
        const { scope, settings } = await forInteraction(interaction);
        const guildBiz = settings.bizGuild && interaction.guildId
            ? await economy.listCatalog(interaction.guildId, "biz")
            : [];
        const defs = mergeBusinesses(settings.bizGlobal !== false, guildBiz);
        const snap = await economy.snapshot(member.id, scope, settings, defs);
        const user = snap.user;
        const need = economy.neededXp(user.level);
        const role = isOwner({ client: interaction.client, user: member })
            ? "Владелец"
            : await economy.isStaff(member.id)
                ? "Модер"
                : null;

        const pending = snap.pending.total
            ? `\nБизнес: **${snap.pending.total}**`
            : "";
        const jobNote = snap.penalty.fired ? " (уволен за простой)" : "";

        const fields = [
            {
                name: "Деньги",
                value: `Наличные: **${user.balance}**\nБанк: **${user.bank}**\nBTC: **${user.btc}**\nВсего: **${user.balance + user.bank}**${pending}`,
                inline: true
            },
            {
                name: "Профессия",
                value: `${getJob(user.job).name}${jobNote}`,
                inline: true
            },
            {
                name: "Уровень",
                value: `**${user.level}**\n${bar(user.xp, need)} ${user.xp}/${need}`,
                inline: true
            }
        ];

        if (role) {
            fields.push({ name: "Статус", value: role, inline: true });
        }

        return reply(interaction, {
            color: COLOR.blurple,
            title: member.username,
            thumbnail: member.displayAvatarURL({ size: 256 }),
            fields
        });
    }
};
