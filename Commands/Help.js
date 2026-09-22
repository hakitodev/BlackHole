const { SlashCommandBuilder } = require("discord.js");
const { PREFIX, PUBLIC_URL } = require("../Config");
const economy = require("../Database/Economy");
const { reply, COLOR } = require("../Utils/reply");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Команды"),
    aliases: ["commands", "cmds"],

    async execute(interaction) {
        const settings = interaction.guild
            ? await economy.getGuildSettings(interaction.guild.id)
            : { prefix: true, prefixText: PREFIX || "!" };
        const prefixOn = settings.prefix;
        const prefix = settings.prefixText || PREFIX || "!";

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
                value: "`/ping` `/avatar` `/user` `/server` `/help` `/settings` `/rank`"
            },
            {
                name: "Развлечения",
                value: "`/8ball` `/roll` `/pick`"
            },
            {
                name: "Мод",
                value: "`/mod` `/give` `/take` `/eco` `/authpanel` `/clear` `/slowmode`"
            }
        ];

        if (prefixOn) {
            fields.push({
                name: "Префикс",
                value: `\`${prefix}collect\` \`${prefix}pay all\``
            });
        }

        if (PUBLIC_URL) {
            fields.push({
                name: "Сайт",
                value: PUBLIC_URL
            });
        }

        fields.push({
            name: "Панель",
            value: "Сайт: ивенты, эмбеды, магаз. Высшие модеры — юзеры и всемирный шоп."
        });

        return reply(interaction, {
            color: COLOR.blurple,
            title: "Команды",
            fields
        });
    }
};
