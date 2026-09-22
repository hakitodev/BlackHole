const { SlashCommandBuilder } = require("discord.js");
const { PREFIX } = require("../Config");
const economy = require("../Database/Economy");
const { reply, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Команды"),
    aliases: ["commands", "cmds"],

    async execute(interaction) {
        const prefixOn = interaction.guild
            ? await economy.isPrefixEnabled(interaction.guild.id)
            : true;
        const prefix = PREFIX || "!";

        const fields = [
            {
                name: "Экономика",
                value: "`/collect` `/bal` `/rob` `/pay` `/flip` `/dep` `/with` `/top` `/profile`"
            },
            {
                name: "Магазин",
                value: "`/shop` `/buy` `/inv`"
            },
            {
                name: "Сервер",
                value: "`/ping` `/avatar` `/user` `/server` `/help` `/settings`"
            },
            {
                name: "Развлечения",
                value: "`/8ball` `/roll` `/pick`"
            },
            {
                name: "Мод",
                value: "`/mod` `/give` `/take` `/authpanel` `/clear` `/slowmode`"
            }
        ];

        if (prefixOn) {
            fields.push({
                name: "Префикс",
                value: `\`${prefix}collect\` \`${prefix}pay all\` — те же имена. Ответ на сообщение подставляет человека.`
            });
        }

        return reply(interaction, {
            color: COLOR.blurple,
            title: "Команды",
            fields
        });
    }
};
