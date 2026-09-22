const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { PREFIX } = require("../Config");

const prefix = PREFIX || "!";

const GROUPS = [
    {
        name: "Экономика",
        value: `\`/collect\` \`/bal\` \`/rob\` \`/pay\` \`/flip\` \`/dep\` \`/with\` \`/top\` \`/profile\``
    },
    {
        name: "Магазин",
        value: "`/shop` `/buy` `/inv`"
    },
    {
        name: "Сервер",
        value: "`/ping` `/avatar` `/user` `/server` `/help`"
    },
    {
        name: "Развлечения",
        value: "`/8ball` `/roll` `/pick`"
    },
    {
        name: "Модерация экономики",
        value: "`/mod` `/give` `/take`"
    },
    {
        name: "Модерация сервера",
        value: "`/authpanel` `/clear` `/slowmode`"
    },
    {
        name: "Префикс",
        value:
            `\`${prefix}collect\` \`${prefix}top\` \`${prefix}rob\` и остальные те же имена.\n` +
            `Ответь на сообщение и напиши команду — человек из ответа подставится сам.\n` +
            `\`daily\`, \`work\`, \`crime\` тоже собирают через collect.`
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Список команд"),
    aliases: ["commands", "cmds"],

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("Команды BlackHole")
            .addFields(GROUPS)
            .setFooter({ text: `Кошелёк общий · префикс ${prefix} · банк нельзя украсть через /rob` });

        await interaction.reply({ embeds: [embed] });
    }
};
