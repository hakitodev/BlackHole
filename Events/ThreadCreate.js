const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "threadCreate",
    async execute(client, thread) {
        if (!thread.guild) {
            return;
        }
        await fireEvent(thread.guild, "threadCreate", {
            channel: `${thread}`,
            user: thread.ownerId ? { id: thread.ownerId } : undefined
        });
    }
};
