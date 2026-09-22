const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "inviteCreate",
    async execute(client, invite) {
        if (!invite.guild) {
            return;
        }
        await fireEvent(invite.guild, "inviteCreate", {
            user: invite.inviter,
            invite: invite.code || "",
            channel: invite.channel ? `${invite.channel}` : ""
        });
    }
};
