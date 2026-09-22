require("./Utils/env");

function normalizePublicUrl(raw) {
    let url = String(raw || "").trim();
    if (!url) {
        return "";
    }

    url = url.replace(/\/+$/, "");
    while (/\/oauth\/callback$/i.test(url)) {
        url = url.replace(/\/oauth\/callback$/i, "").replace(/\/+$/, "");
    }

    return url;
}

function resolvePublicUrl() {
    const explicit = normalizePublicUrl(process.env.PUBLIC_URL);
    if (explicit) {
        return explicit;
    }

    const render = normalizePublicUrl(process.env.RENDER_EXTERNAL_URL);
    if (render) {
        return render;
    }

    const railway = normalizePublicUrl(process.env.RAILWAY_PUBLIC_DOMAIN);
    if (railway) {
        return railway.startsWith("http") ? railway : `https://${railway}`;
    }

    return "";
}

module.exports = {
    CLIENT_ID: process.env.CLIENT_ID || "",
    CLIENT_SECRET: process.env.CLIENT_SECRET || "",
    OWNER_ID: process.env.OWNER_ID || "",
    PREFIX: (process.env.PREFIX ?? "!").trim() || "!",
    PUBLIC_URL: resolvePublicUrl()
};
