const { EmbedBuilder } = require("discord.js");

const COLOR = {
    blurple: 0x5865F2,
    gold: 0xFEE75C,
    green: 0x57F287,
    red: 0xED4245,
    pink: 0xEB459E
};

function embed({
    title,
    description,
    color,
    fields,
    thumbnail,
    image,
    url,
    footer
} = {}) {
    const result = new EmbedBuilder().setColor(color ?? COLOR.blurple);

    if (title) {
        result.setTitle(title);
    }
    if (description) {
        result.setDescription(description);
    }
    if (fields?.length) {
        result.addFields(fields);
    }
    if (thumbnail) {
        result.setThumbnail(thumbnail);
    }
    if (image) {
        result.setImage(image);
    }
    if (url) {
        result.setURL(url);
    }
    if (footer) {
        result.setFooter({ text: footer });
    }

    return result;
}

function payload(options = {}) {
    const { ephemeral, components, fetchReply, ...rest } = options;
    const body = {
        embeds: rest.embeds ?? [embed(rest)]
    };

    if (ephemeral) {
        body.ephemeral = true;
    }
    if (components) {
        body.components = components;
    }
    if (fetchReply) {
        body.fetchReply = true;
    }

    return body;
}

function reply(interaction, options) {
    return interaction.reply(payload(options));
}

function editReply(interaction, options) {
    return interaction.editReply(payload(options));
}

function error(interaction, description) {
    return reply(interaction, {
        description,
        color: COLOR.red,
        ephemeral: true
    });
}

module.exports = {
    COLOR,
    embed,
    payload,
    reply,
    editReply,
    error
};
