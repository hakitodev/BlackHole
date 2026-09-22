const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "guildMemberUpdate",
    async execute(client, oldMember, newMember) {
        if (!oldMember.premiumSince && newMember.premiumSince) {
            await fireEvent(newMember.guild, "boost", { user: newMember.user });
        }
    }
};
