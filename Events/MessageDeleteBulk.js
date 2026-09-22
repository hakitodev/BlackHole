const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "messageDeleteBulk",
    async execute(client, messages, channel) {
        const guild = channel?.guild || messages.first()?.guild;
        if (!guild) {
            return;
        }
        await fireEvent(guild, "messageBulkDelete", {
            channel: channel ? `${channel}` : "",
            count: messages.size || messages.length || 0
        });
    }
};
