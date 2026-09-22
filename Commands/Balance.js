const { SlashCommandBuilder } = require("discord.js");
const economy = require("../Database/Economy");
const { forInteraction } = require("../Utils/scope");
const { mergeBusinesses } = require("../Utils/business");
const { editReply, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bal")
        .setDescription("Баланс")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь или ответ на сообщение")
        ),
    aliases: ["balance", "money", "wallet"],

    async execute(interaction) {
        await interaction.deferReply();

        const member = interaction.options.getUser("user") ?? interaction.user;
        const { scope, settings } = await forInteraction(interaction);
        const local = settings.bizGuild && interaction.guildId
            ? await economy.listCatalog(interaction.guildId, "biz")
            : [];
        const defs = mergeBusinesses(settings.bizGlobal !== false, local);
        const snap = await economy.snapshot(member.id, scope, settings, defs);
        const user = snap.user;
        const pending = snap.pending.total
            ? `\nБизнес (не собрано): **${snap.pending.total}**`
            : "";
        const stalled = snap.pending.stalled
            ? `\nПростаивает: **${snap.pending.stalled}**`
            : "";
        const fired = snap.penalty.fired ? `\nПрофессия сброшена за простой.` : "";

        return editReply(interaction, {
            color: COLOR.gold,
            title: member.username,
            description:
                `Наличные: **${user.balance}**\n` +
                `Банк: **${user.bank}**\n` +
                `BTC: **${user.btc}**\n` +
                `Всего: **${user.balance + user.bank}**` +
                pending + stalled + fired
        });
    }
};
