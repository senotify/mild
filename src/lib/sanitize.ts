import sanitizeHtml from "sanitize-html";

/**
 * Every post body passes through here before it is stored, whoever wrote it.
 * External links from ordinary users get nofollow/ugc so the site is useless
 * for link spam; the owner's own links stay followable.
 */
export function cleanPostHtml(html: string, trusted: boolean): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "s", "u", "a", "blockquote",
      "ul", "ol", "li", "pre", "code", "img", "hr", "figure", "figcaption",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      img: ["src", "alt", "title"],
      code: ["class"],
      th: ["align"],
      td: ["align"],
    },
    allowedClasses: { code: [/^language-[\w-]+$/] },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https", "http"] },
    allowProtocolRelative: false,
    transformTags: {
      h1: "h2",
      a: (tag, attribs) => {
        const href = attribs.href || "";
        const external = /^https?:\/\//i.test(href) && !/^https?:\/\/mild\.senotify\.com/i.test(href);
        const rel = external ? (trusted ? "noopener" : "nofollow ugc noopener") : undefined;
        // Rebuild attributes so user-supplied rel/target never survive.
        const out: Record<string, string> = { href };
        if (attribs.title) out.title = attribs.title;
        if (rel) Object.assign(out, { rel, target: "_blank" });
        return { tagName: "a", attribs: out };
      },
    },
  });
}

export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function readingMinutes(text: string) {
  return Math.max(1, Math.round(text.split(/\s+/).length / 230));
}
