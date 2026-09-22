const economy = require("../Database/Economy");
const { fireEvent } = require("../Utils/events");
const { applyAutoroles } = require("../Utils/autorole");

module.exports = {
    name: "guildMemberAdd",
    async execute(client, member) {
        const settings = await economy.getGuildSettings(member.guild.id);
        await applyAutoroles(member, settings);
        await fireEvent(member.guild, "join", { user: member.user });
    }
};
