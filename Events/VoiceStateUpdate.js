const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "voiceStateUpdate",
    async execute(client, before, after) {
        const member = after.member || before.member;
        const guild = after.guild || before.guild;
        if (!member || !guild || member.user?.bot) {
            return;
        }

        const user = member.user;
        if (!before.channelId && after.channel) {
            await fireEvent(guild, "voiceJoin", { user, channel: `${after.channel}` });
            return;
        }
        if (before.channel && !after.channelId) {
            await fireEvent(guild, "voiceLeave", { user, channel: `${before.channel}` });
            return;
        }
        if (before.channelId && after.channelId && before.channelId !== after.channelId) {
            await fireEvent(guild, "voiceSwitch", {
                user,
                old: `${before.channel}`,
                channel: `${after.channel}`
            });
        }
    }
};
