const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "emojiCreate",
    async execute(client, emoji) {
        if (!emoji.guild) {
            return;
        }
        await fireEvent(emoji.guild, "emojiCreate", { text: emoji.name || "" });
    }
};
