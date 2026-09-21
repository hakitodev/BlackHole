const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const GROUPS = [
    {
        name: "Экономика",
        value: "`/bal` `/daily` `/work` `/crime` `/rob` `/pay` `/flip` `/dep` `/with` `/top` `/profile`"
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
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Список команд"),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("Команды BlackHole")
            .addFields(GROUPS)
            .setFooter({ text: "Кошелёк общий на все серверы · банк нельзя украсть через /rob" });

        await interaction.reply({ embeds: [embed] });
    }
};
