const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "guildUpdate",
    async execute(client, before, after) {
        if (before.name === after.name) {
            return;
        }
        await fireEvent(after, "guildUpdate", { old: before.name });
    }
};
