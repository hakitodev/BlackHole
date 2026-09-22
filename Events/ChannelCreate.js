const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "channelCreate",
    async execute(client, channel) {
        if (!channel.guild) {
            return;
        }
        await fireEvent(channel.guild, "channelCreate", {
            channel: `${channel}`
        });
    }
};
