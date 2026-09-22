(() => {
    const menu = document.querySelector("[data-panel]");
    const close = document.querySelector("[data-panel-close]");
    if (menu) {
        menu.addEventListener("click", () => document.body.classList.toggle("panel-open"));
    }
    if (close) {
        close.addEventListener("click", () => document.body.classList.remove("panel-open"));
    }

    const form = document.querySelector("[data-editor]");
    const preview = document.getElementById("live-preview");
    if (!form || !preview) {
        return;
    }

    const botName = preview.dataset.botName || "BlackHole";
    const botAvatar = preview.dataset.botAvatar || "";
    let lastField = form.querySelector("[name=response]");

    function val(name) {
        const el = form.querySelector(`[name="${name}"]`);
        if (!el) {
            return "";
        }
        if (el.type === "checkbox") {
            return el.checked;
        }
        return el.value || "";
    }

    function safeUrl(raw) {
        try {
            const url = new URL(String(raw || ""));
            if (url.protocol === "http:" || url.protocol === "https:") {
                return url.href;
            }
        } catch {
            return "";
        }
        return "";
    }

    function safeColor(raw) {
        const text = String(raw || "").trim();
        return /^#[0-9a-fA-F]{6}$/.test(text) ? text : "#e10600";
    }

    function el(tag, className) {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        return node;
    }

    function text(node, value) {
        node.textContent = value == null ? "" : String(value);
        return node;
    }

    function appendMd(parent, raw) {
        const source = String(raw ?? "");
        const pattern = /```([\s\S]*?)```|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|~~([^~]+)~~|\|\|([^|]+)\|\||\[([^\]]+)\]\((https?:[^)]+)\)|\n/g;
        let last = 0;
        let match;
        while ((match = pattern.exec(source))) {
            if (match.index > last) {
                parent.appendChild(document.createTextNode(source.slice(last, match.index)));
            }
            if (match[0] === "\n") {
                parent.appendChild(el("br"));
            } else if (match[1] != null) {
                parent.appendChild(text(el("pre"), match[1]));
            } else if (match[2] != null) {
                parent.appendChild(text(el("code"), match[2]));
            } else if (match[3] != null) {
                parent.appendChild(text(el("b"), match[3]));
            } else if (match[4] != null) {
                parent.appendChild(text(el("u"), match[4]));
            } else if (match[5] != null) {
                parent.appendChild(text(el("i"), match[5]));
            } else if (match[6] != null) {
                parent.appendChild(text(el("s"), match[6]));
            } else if (match[7] != null) {
                const spoiler = el("span", "spoiler");
                text(spoiler, match[7]);
                parent.appendChild(spoiler);
            } else if (match[8] != null) {
                const href = safeUrl(match[9]);
                if (href) {
                    const link = el("a");
                    link.href = href;
                    link.target = "_blank";
                    link.rel = "noreferrer";
                    text(link, match[8]);
                    parent.appendChild(link);
                } else {
                    parent.appendChild(document.createTextNode(match[8]));
                }
            }
            last = match.index + match[0].length;
        }
        if (last < source.length) {
            parent.appendChild(document.createTextNode(source.slice(last)));
        }
    }

    function render() {
        const color = safeColor(val("colorHex") || val("color") || "#e10600");
        const content = val("content");
        const title = val("title");
        const desc = val("response") || (!form.querySelector("[name=content]") ? val("message") : "");
        const footer = val("footer");
        const author = val("author");
        const image = safeUrl(val("image"));
        const thumb = safeUrl(val("thumbnail"));
        const url = safeUrl(val("url"));
        const fields = val("fields");
        const showEmbed = title || desc || footer || author || image || thumb || fields;

        preview.replaceChildren();
        const wrap = el("div", "dmsg");
        if (safeUrl(botAvatar)) {
            const av = el("img", "dmsg-av");
            av.src = safeUrl(botAvatar);
            av.alt = "";
            wrap.appendChild(av);
        } else {
            wrap.appendChild(el("div", "dmsg-av dmsg-av-empty"));
        }

        const body = el("div", "dmsg-body");
        const head = el("div", "dmsg-head");
        head.appendChild(text(el("span", "dmsg-name"), botName));
        head.appendChild(text(el("span", "dbot"), "BOT"));
        body.appendChild(head);

        if (content) {
            const textNode = el("div", "dmsg-text");
            appendMd(textNode, content);
            body.appendChild(textNode);
        }

        if (showEmbed) {
            const embed = el("div", "dembed");
            embed.style.borderLeftColor = color;
            const main = el("div", "dembed-main");
            if (author) {
                main.appendChild(text(el("div", "dembed-author"), author));
            }
            if (title) {
                const titleNode = el("div", "dembed-title");
                if (url) {
                    const link = el("a");
                    link.href = url;
                    text(link, title);
                    titleNode.appendChild(link);
                } else {
                    text(titleNode, title);
                }
                main.appendChild(titleNode);
            }
            if (desc) {
                const descNode = el("div", "dembed-desc");
                appendMd(descNode, desc);
                main.appendChild(descNode);
            }
            if (fields) {
                const box = el("div", "dfields");
                String(fields).split("\n").forEach(line => {
                    const parts = line.split("|").map(part => part.trim());
                    if (!parts[0]) {
                        return;
                    }
                    const field = el("div", parts[2] === "inline" || parts[2] === "1" ? "dfield inline" : "dfield");
                    field.appendChild(text(el("div", "dfield-n"), parts[0]));
                    const value = el("div");
                    appendMd(value, parts[1] || "");
                    field.appendChild(value);
                    box.appendChild(field);
                });
                main.appendChild(box);
            }
            if (footer) {
                main.appendChild(text(el("div", "dembed-footer"), footer));
            }
            embed.appendChild(main);
            if (thumb) {
                const img = el("img", "dembed-thumb");
                img.src = thumb;
                img.alt = "";
                embed.appendChild(img);
            }
            body.appendChild(embed);
            if (image) {
                const img = el("img", "dembed-image");
                img.src = image;
                img.alt = "";
                body.appendChild(img);
            }
        }

        wrap.appendChild(body);
        preview.appendChild(wrap);
    }

    form.querySelectorAll("input, textarea").forEach(node => {
        node.addEventListener("focus", () => {
            lastField = node;
        });
        node.addEventListener("input", render);
        node.addEventListener("change", render);
    });

    document.querySelectorAll("[data-tag]").forEach(chip => {
        chip.addEventListener("click", () => {
            const tag = chip.getAttribute("data-tag") || "";
            const target = lastField || form.querySelector("textarea");
            if (!target || target.readOnly) {
                return;
            }
            const start = target.selectionStart ?? target.value.length;
            const end = target.selectionEnd ?? start;
            target.value = target.value.slice(0, start) + tag + target.value.slice(end);
            target.focus();
            const pos = start + tag.length;
            if (target.setSelectionRange) {
                target.setSelectionRange(pos, pos);
            }
            render();
        });
    });

    render();
})();
