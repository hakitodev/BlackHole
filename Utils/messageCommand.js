const { parseOptionValues, tokenize } = require("./prefix");

function payload(data) {
    if (typeof data === "string") {
        return { content: data };
    }

    const next = { ...data };
    delete next.ephemeral;
    delete next.fetchReply;
    return next;
}

async function fetchUser(message, id) {
    if (!id) {
        return null;
    }

    if (message.guild) {
        const member = await message.guild.members.fetch(id).catch(() => null);
        if (member) {
            return member.user;
        }
    }

    return message.client.users.fetch(id).catch(() => null);
}

async function fetchRole(message, id) {
    if (!id || !message.guild) {
        return null;
    }

    return message.guild.roles.fetch(id).catch(() => null);
}

function createOptions(resolved, sub) {
    return {
        getSubcommand() {
            return sub;
        },
        getUser(name) {
            return resolved[name] ?? null;
        },
        getRole(name) {
            return resolved[name] ?? null;
        },
        getString(name) {
            const value = resolved[name];
            return value == null ? null : String(value);
        },
        getInteger(name) {
            const value = resolved[name];
            return Number.isInteger(value) ? value : null;
        },
        getFocused() {
            return "";
        }
    };
}

async function createMessageContext(message, command, rest, repliedUser) {
    const tokens = tokenize(rest);
    const json = command.data.toJSON();
    const parsed = parseOptionValues(tokens, json, repliedUser?.id);
    const resolved = {};

    for (const [name, value] of Object.entries(parsed.values)) {
        if (!value) {
            resolved[name] = null;
            continue;
        }

        if (value.type === "user") {
            resolved[name] = await fetchUser(message, value.id);
            continue;
        }

        if (value.type === "role") {
            resolved[name] = await fetchRole(message, value.id);
            continue;
        }

        resolved[name] = value.type === "int" ? value.value : value.value;
    }

    const context = {
        user: message.author,
        member: message.member,
        guild: message.guild,
        client: message.client,
        channel: message.channel,
        memberPermissions: message.member?.permissions,
        createdTimestamp: message.createdTimestamp,
        replied: false,
        deferred: false,
        _reply: null,
        options: createOptions(resolved, parsed.sub),
        inGuild() {
            return Boolean(message.guild);
        },
        async reply(data) {
            context.replied = true;
            context._reply = await message.reply(payload(data));
            return context._reply;
        },
        async deferReply() {
            context.deferred = true;
            await message.channel.sendTyping().catch(() => {});
        },
        async editReply(data) {
            const body = payload(data);
            if (context._reply) {
                return context._reply.edit(body);
            }

            context.replied = true;
            context._reply = await message.reply(body);
            return context._reply;
        },
        async followUp(data) {
            return message.channel.send(payload(data));
        }
    };

    return context;
}

module.exports = {
    createMessageContext
};
