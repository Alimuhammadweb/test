import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { SITE } from "./util";

// Authors write Markdown-lite: paragraphs, single line breaks, **bold**, *italic*, lists,
// quotes, [links](url) and bare URLs (auto-linked). Everything goes through an allow-list
// sanitizer, so raw HTML / <script> / javascript: URLs never reach the page.
const md = new Marked({ gfm: true, breaks: true });

const isExternal = (href: string) => /^https?:\/\//i.test(href) && !href.startsWith(SITE + "/") && href !== SITE;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "del", "a", "ul", "ol", "li", "blockquote", "h2", "h3", "h4", "hr", "code", "pre", "img"],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "loading", "decoding"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    h1: "h2",
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const out: Record<string, string> = { href };
      if (attribs.title) out.title = attribs.title;
      if (isExternal(href)) { out.target = "_blank"; out.rel = "noopener noreferrer nofollow ugc"; }
      return { tagName, attribs: out };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { src: attribs.src ?? "", alt: attribs.alt ?? "", loading: "lazy", decoding: "async" } }),
  },
};

export function renderContent(text: string) {
  return sanitizeHtml(md.parse(text, { async: false }) as string, OPTIONS);
}

/** Plain-text summary (no markup) used for excerpts and meta descriptions. */
export function plainText(text: string, max = 180) {
  // Block ends and <br> become spaces so words from adjacent lines never run together.
  const html = (md.parse(text, { async: false }) as string).replace(/<\/(p|li|h[1-6]|blockquote|pre)>|<br\s*\/?>/gi, " ");
  const t = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" } as Record<string, string>)[e])
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).replace(/[\s.,;:!?-]+$/, "") + "…";
}

/** True when the stored excerpt is just the auto-generated start of the body (so it should not be shown again as a standfirst). */
export function excerptIsAuto(excerpt: string, content: string) {
  const norm = (x: string) => x.replace(/\s+/g, " ").trim();
  const e = norm(excerpt.replace(/…$/, ""));
  return !e || norm(plainText(content, e.length + 40)).startsWith(e);
}
