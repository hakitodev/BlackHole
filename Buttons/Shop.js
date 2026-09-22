const { parseShopId, buildShopMessage } = require("../Utils/shopView");
const { embed, COLOR } = require("../Utils/reply");

module.exports = {
    id: "shop",

    async execute(interaction) {
        const parsed = parseShopId(interaction.customId);
        const payload = await buildShopMessage(interaction.guildId, parsed.scope);

        if (!payload) {
            return interaction.update({
                embeds: [embed({ description: "Пока пусто.", color: COLOR.red })],
                components: []
            });
        }

        await interaction.update(payload);
    }
};
