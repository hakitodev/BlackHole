const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "roleCreate",
    async execute(client, role) {
        if (!role.guild) {
            return;
        }
        await fireEvent(role.guild, "roleCreate", { role: role.name });
    }
};
