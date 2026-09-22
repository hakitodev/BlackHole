const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "guildBanAdd",
    async execute(client, ban) {
        await fireEvent(ban.guild, "ban", {
            user: ban.user,
            reason: ban.reason || "причина отсутствует"
        });
    }
};
