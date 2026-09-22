const { EmbedBuilder } = require("discord.js");
const { fill } = require("./placeholders");
const { parseColor, isUrl } = require("./color");

function parseFields(raw) {
    return String(raw ?? "")
        .split("\n")
        .map(line => {
            const parts = String(line).split("|").map(part => part.trim());
            if (!parts[0]) {
                return null;
            }
            return {
                name: parts[0].slice(0, 256),
                value: (parts[1] || "\u200b").slice(0, 1024),
                inline: parts[2] === "inline" || parts[2] === "1"
            };
        })
        .filter(Boolean)
        .slice(0, 25);
}

function fieldsText(fields) {
    if (!Array.isArray(fields) || !fields.length) {
        return "";
    }
    return fields.map(field => {
        const inline = field.inline ? " | inline" : "";
        return `${field.name} | ${field.value}${inline}`;
    }).join("\n");
}

function customPayload(custom, vars = {}) {
    const content = custom.content ? fill(custom.content, vars).slice(0, 2000) : "";
    const title = custom.title ? fill(custom.title, vars).slice(0, 256) : "";
    const description = custom.response ? fill(custom.response, vars).slice(0, 4096) : "";
    const footer = custom.footer ? fill(custom.footer, vars).slice(0, 2048) : "";
    const author = custom.author ? fill(custom.author, vars).slice(0, 256) : "";
    const fields = parseFields(custom.fields).map(field => ({
        name: fill(field.name, vars).slice(0, 256),
        value: fill(field.value, vars).slice(0, 1024),
        inline: field.inline
    }));

    const hasEmbed = Boolean(
        title || description || footer || author || custom.image || custom.thumbnail || fields.length
    );

    const payload = {};
    if (content) {
        payload.content = content;
    }

    if (hasEmbed) {
        const embed = new EmbedBuilder().setColor(parseColor(custom.color));
        if (title) {
            embed.setTitle(title);
        }
        if (custom.url && isUrl(custom.url)) {
            embed.setURL(custom.url);
        }
        if (description) {
            embed.setDescription(description);
        }
        if (isUrl(custom.image)) {
            embed.setImage(custom.image);
        }
        if (isUrl(custom.thumbnail)) {
            embed.setThumbnail(custom.thumbnail);
        }
        if (author) {
            const data = { name: author };
            if (isUrl(custom.authorIcon)) {
                data.iconURL = custom.authorIcon;
            }
            embed.setAuthor(data);
        }
        if (footer) {
            const data = { text: footer };
            if (isUrl(custom.footerIcon)) {
                data.iconURL = custom.footerIcon;
            }
            embed.setFooter(data);
        }
        if (fields.length) {
            embed.addFields(fields);
        }
        if (custom.timestamp) {
            embed.setTimestamp(new Date());
        }
        payload.embeds = [embed];
    }

    return payload;
}

module.exports = {
    parseFields,
    fieldsText,
    customPayload
};
