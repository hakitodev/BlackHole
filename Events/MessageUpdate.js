const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "messageUpdate",
    async execute(client, before, after) {
        if (!after.guild || after.author?.bot) {
            return;
        }
        if (before.content === after.content) {
            return;
        }

        await fireEvent(after.guild, "messageUpdate", {
            user: after.author,
            channel: `${after.channel}`,
            text: String(before.content || "").slice(0, 800) || "без текста",
            after: String(after.content || "").slice(0, 800) || "без текста"
        });
    }
};
