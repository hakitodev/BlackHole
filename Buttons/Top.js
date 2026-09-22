const { parseTopId, nextState, buildTopMessage } = require("../Utils/top");
const economy = require("../Database/Economy");
const { embed, COLOR } = require("../Utils/reply");

module.exports = {
    id: "top",

    async execute(interaction) {
        const parsed = parseTopId(interaction.customId);
        const total = await economy.countUsers();
        const state = nextState(parsed.action, parsed.type, parsed.page, total);
        const payload = await buildTopMessage(state.type, state.page);

        if (!payload) {
            return interaction.update({
                embeds: [embed({ description: "Пока некого показывать.", color: COLOR.red })],
                components: []
            });
        }

        await interaction.update(payload);
    }
};
