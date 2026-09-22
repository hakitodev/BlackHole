const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "messageDelete",
    async execute(client, message) {
        if (!message.guild || message.author?.bot) {
            return;
        }

        const snippet = String(message.content || "").slice(0, 800) || "без текста";
        await fireEvent(message.guild, "messageDelete", {
            user: message.author,
            channel: `${message.channel}`,
            text: snippet
        });
    }
};
