const OPTION = {
    SUB_COMMAND: 1,
    STRING: 3,
    INTEGER: 4,
    USER: 6,
    ROLE: 8
};

function stripPrefix(content, prefix, botId) {
    const text = String(content ?? "").trim();
    if (!text) {
        return null;
    }

    if (prefix && text.startsWith(prefix)) {
        return text.slice(prefix.length).trimStart();
    }

    if (botId) {
        const mentions = [`<@${botId}>`, `<@!${botId}>`];
        for (const mention of mentions) {
            if (text.startsWith(mention)) {
                return text.slice(mention.length).trimStart();
            }
        }
    }

    return null;
}

function splitCommand(rest) {
    const text = String(rest ?? "").trim();
    if (!text) {
        return null;
    }

    const match = text.match(/^(\S+)(?:\s+([\s\S]*))?$/);
    if (!match) {
        return null;
    }

    return {
        name: match[1].toLowerCase(),
        rest: match[2] ?? ""
    };
}

function tokenize(text) {
    const tokens = [];
    const source = String(text ?? "").trim();
    const pattern = /"([^"]+)"|<@!?\d+>|<@&\d+>|<#\d+>|\S+/g;
    let match;

    while ((match = pattern.exec(source))) {
        tokens.push(match[1] ?? match[0]);
    }

    return tokens;
}

function parseUserId(token) {
    if (!token) {
        return null;
    }

    const mention = String(token).match(/^<@!?(\d{17,20})>$/);
    if (mention) {
        return mention[1];
    }

    if (/^\d{17,20}$/.test(token)) {
        return token;
    }

    return null;
}

function parseRoleId(token) {
    if (!token) {
        return null;
    }

    const mention = String(token).match(/^<@&(\d{17,20})>$/);
    if (mention) {
        return mention[1];
    }

    if (/^\d{17,20}$/.test(token)) {
        return token;
    }

    return null;
}

function parseOptionValues(tokens, commandJson, repliedUserId) {
    const values = {};
    const list = commandJson?.options ?? [];
    let index = 0;
    let sub = null;
    let options = list;
    let usedReply = false;

    if (list[0]?.type === OPTION.SUB_COMMAND) {
        const token = tokens[0]?.toLowerCase();
        const match = list.find(option => option.name === token);
        if (!match) {
            return { values, sub: null };
        }

        sub = match.name;
        index = 1;
        options = match.options ?? [];
    }

    for (const option of options) {
        if (option.type === OPTION.USER) {
            const id = parseUserId(tokens[index]);
            if (id) {
                values[option.name] = { type: "user", id };
                index += 1;
                continue;
            }

            if (repliedUserId && !usedReply) {
                values[option.name] = { type: "user", id: String(repliedUserId) };
                usedReply = true;
            } else {
                values[option.name] = null;
            }
            continue;
        }

        if (option.type === OPTION.INTEGER) {
            const token = tokens[index];
            if (token && /^-?\d+$/.test(token) && !parseUserId(token)) {
                values[option.name] = { type: "int", value: Number(token) };
                index += 1;
            } else {
                values[option.name] = null;
            }
            continue;
        }

        if (option.type === OPTION.STRING) {
            const later = options.slice(options.indexOf(option) + 1);
            const takesRest = later.every(item => item.type === OPTION.STRING && !item.required);

            if (takesRest || later.length === 0) {
                const rest = tokens.slice(index).join(" ");
                values[option.name] = rest ? { type: "string", value: rest } : null;
                index = tokens.length;
            } else if (tokens[index]) {
                values[option.name] = { type: "string", value: tokens[index] };
                index += 1;
            } else {
                values[option.name] = null;
            }
            continue;
        }

        if (option.type === OPTION.ROLE) {
            const id = parseRoleId(tokens[index]);
            if (id) {
                values[option.name] = { type: "role", id };
                index += 1;
            } else {
                values[option.name] = null;
            }
        }
    }

    return { values, sub };
}

module.exports = {
    OPTION,
    stripPrefix,
    splitCommand,
    tokenize,
    parseUserId,
    parseRoleId,
    parseOptionValues
};
