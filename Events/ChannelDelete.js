const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "channelDelete",
    async execute(client, channel) {
        if (!channel.guild) {
            return;
        }
        await fireEvent(channel.guild, "channelDelete", {
            channel: `#${channel.name || channel.id}`
        });
    }
};
