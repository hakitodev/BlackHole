const { fireEvent } = require("../Utils/events");

module.exports = {
    name: "roleDelete",
    async execute(client, role) {
        if (!role.guild) {
            return;
        }
        await fireEvent(role.guild, "roleDelete", { role: role.name });
    }
};
