(() => {
    const form = document.querySelector("[data-editor]");
    if (!form) {
        return;
    }

    const preview = document.getElementById("live-preview");
    if (!preview) {
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

    function esc(text) {
        return String(text ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function md(text) {
        let out = esc(text);
        out = out.replace(/```([\s\S]*?)```/g, "<pre>$1</pre>");
        out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
        out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
        out = out.replace(/__([^_]+)__/g, "<u>$1</u>");
        out = out.replace(/\*([^*]+)\*/g, "<i>$1</i>");
        out = out.replace(/~~([^~]+)~~/g, "<s>$1</s>");
        out = out.replace(/\|\|([^|]+)\|\|/g, "<span class=\"spoiler\">$1</span>");
        out = out.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "<a href=\"$2\" target=\"_blank\" rel=\"noreferrer\">$1</a>");
        return out.replace(/\n/g, "<br>");
    }

    function fieldRows(raw) {
        return String(raw || "").split("\n").map(line => {
            const parts = line.split("|").map(part => part.trim());
            if (!parts[0]) {
                return "";
            }
            return `<div class="dfield ${parts[2] === "inline" || parts[2] === "1" ? "inline" : ""}"><div class="dfield-n">${esc(parts[0])}</div><div>${md(parts[1] || "")}</div></div>`;
        }).join("");
    }

    function render() {
        const color = val("colorHex") || val("color") || "#5865F2";
        const content = val("content");
        const title = val("title");
        const desc = val("response") || (!form.querySelector("[name=content]") ? val("message") : "");
        const footer = val("footer");
        const author = val("author");
        const image = val("image");
        const thumb = val("thumbnail");
        const url = val("url");
        const fields = val("fields");
        const showEmbed = title || desc || footer || author || image || thumb || fields;

        const av = botAvatar
            ? `<img class="dmsg-av" src="${esc(botAvatar)}" alt="">`
            : `<div class="dmsg-av dmsg-av-empty"></div>`;

        preview.innerHTML = `
          <div class="dmsg">
            ${av}
            <div class="dmsg-body">
              <div class="dmsg-head">
                <span class="dmsg-name">${esc(botName)}</span>
                <span class="dbot">BOT</span>
              </div>
              ${content ? `<div class="dmsg-text">${md(content)}</div>` : ""}
              ${showEmbed ? `
                <div class="dembed" style="border-left-color:${esc(color)}">
                  <div class="dembed-main">
                    ${author ? `<div class="dembed-author">${esc(author)}</div>` : ""}
                    ${title ? `<div class="dembed-title">${url ? `<a href="${esc(url)}">${esc(title)}</a>` : esc(title)}</div>` : ""}
                    ${desc ? `<div class="dembed-desc">${md(desc)}</div>` : ""}
                    ${fields ? `<div class="dfields">${fieldRows(fields)}</div>` : ""}
                    ${footer ? `<div class="dembed-footer">${esc(footer)}</div>` : ""}
                  </div>
                  ${thumb ? `<img class="dembed-thumb" src="${esc(thumb)}" alt="">` : ""}
                </div>
                ${image ? `<img class="dembed-image" src="${esc(image)}" alt="">` : ""}
              ` : ""}
            </div>
          </div>
        `;
    }

    form.querySelectorAll("input, textarea").forEach(el => {
        el.addEventListener("focus", () => {
            lastField = el;
        });
        el.addEventListener("input", render);
        el.addEventListener("change", render);
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
