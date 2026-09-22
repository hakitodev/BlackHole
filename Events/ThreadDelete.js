const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "threadDelete",
    async execute(client, thread) {
        if (!thread.guild) {
            return;
        }
        await fireEvent(thread.guild, "threadDelete", {
            channel: `#${thread.name || thread.id}`
        });
    }
};
