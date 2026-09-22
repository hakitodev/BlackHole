const { CLIENT_ID, CLIENT_SECRET, PUBLIC_URL } = require("../Config");

function publicUrl(req) {
    if (PUBLIC_URL) {
        return PUBLIC_URL;
    }

    const host = req.headers.host || `localhost:${process.env.PORT || 3000}`;
    const proto = req.headers["x-forwarded-proto"] || "http";
    return `${proto}://${host}`;
}

function redirectUri(req) {
    return `${publicUrl(req)}/oauth/callback`;
}

function authorizeUrl(req, state) {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri(req),
        response_type: "code",
        scope: "identify guilds",
        state,
        prompt: "consent"
    });
    return `https://discord.com/api/oauth2/authorize?${params}`;
}

function inviteUrl(guildId) {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        permissions: "268823632",
        scope: "bot applications.commands"
    });

    if (guildId) {
        params.set("guild_id", String(guildId));
        params.set("disable_guild_select", "true");
    }

    return `https://discord.com/oauth2/authorize?${params}`;
}

async function exchangeCode(req, code) {
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(req)
    });

    const response = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`oauth token: ${response.status} ${text}`);
    }

    return response.json();
}

async function refreshAccess(refreshToken) {
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken
    });

    const response = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`oauth refresh: ${response.status} ${text}`);
    }

    return response.json();
}

async function discordGet(token, path) {
    const response = await fetch(`https://discord.com/api${path}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`discord ${path}: ${response.status} ${text}`);
    }

    return response.json();
}

module.exports = {
    publicUrl,
    redirectUri,
    authorizeUrl,
    inviteUrl,
    exchangeCode,
    refreshAccess,
    discordGet
};
