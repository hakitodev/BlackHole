const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "guildBanRemove",
    async execute(client, ban) {
        await fireEvent(ban.guild, "unban", { user: ban.user });
    }
};
