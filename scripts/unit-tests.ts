import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { validateImage, ImageError } from "../src/lib/image";
import { renderContent, plainText, excerptIsAuto } from "../src/lib/content";
import { fmtDate, fmtTime, slugify, zonedDayStart } from "../src/lib/util";
import { splitMedia } from "../src/lib/media";

let n = 0;
const t = (name: string, fn: () => void) => { try { fn(); n++; console.log("  ok  ", name); } catch (e) { console.error("  FAIL", name, "\n", e); process.exitCode = 1; } };
const bad = (fn: () => unknown, re: RegExp) => assert.throws(fn, (e) => e instanceof ImageError && re.test(e.message));

// --- build tiny valid images ---
const crcT = Array.from({ length: 256 }, (_, i) => { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type: string, data: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(w = 2, h = 2) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const jpeg = Buffer.from("ffd8ffe000104a46494600010100000100010000ffc0000b080003000401012200ffda0008010100003f00d2cf20ffd9", "hex"); // 4x3
const webpL = (() => { const b = Buffer.alloc(30); b.write("RIFF", 0); b.writeUInt32LE(22, 4); b.write("WEBPVP8L", 8); b.writeUInt32LE(10, 16); b[20] = 0x2f; b.writeUInt32LE(5 - 1 | ((7 - 1) << 14), 21); return b; })();

console.log("image validation");
t("valid PNG", () => { const r = validateImage(png(), "image/png", "a.png"); assert.deepEqual([r.mime, r.width, r.height], ["image/png", 2, 2]); });
t("valid JPEG dims", () => { const r = validateImage(jpeg, "image/jpeg", "a.JPG"); assert.deepEqual([r.width, r.height], [4, 3]); });
t("valid WebP (lossless) dims", () => { const r = validateImage(webpL, "image/webp", "a.webp"); assert.deepEqual([r.width, r.height], [5, 7]); });
t("rejects GIF / unknown bytes", () => bad(() => validateImage(Buffer.from("GIF89a" + "x".repeat(40)), "image/gif", "a.gif"), /JPEG, PNG/));
t("rejects HTML renamed to .png", () => bad(() => validateImage(Buffer.from("<script>alert(1)</script>".padEnd(40)), "image/png", "a.png"), /JPEG, PNG/));
t("rejects MIME/real type mismatch", () => bad(() => validateImage(png(), "image/jpeg", "a.jpg"), /mos emas/));
t("rejects extension mismatch", () => bad(() => validateImage(png(), "image/png", "a.jpg"), /kengaytma/));
t("rejects truncated PNG", () => bad(() => validateImage(png().subarray(0, 40), "image/png", "a.png"), /to‘liq emas|buzilgan/));
t("rejects PNG with flipped byte (CRC)", () => { const b = png(); b[b.length - 20] ^= 0xff; bad(() => validateImage(b, "image/png", "a.png"), /buzilgan|to‘liq/); });
t("rejects truncated JPEG", () => bad(() => validateImage(jpeg.subarray(0, 30), "image/jpeg", "a.jpg"), /to‘liq|aniqlab|buzilgan/));
t("rejects empty + oversize", () => { bad(() => validateImage(Buffer.alloc(0), "image/png", "a.png"), /bo‘sh/); bad(() => validateImage(Buffer.concat([png(), Buffer.alloc(4 * 1048576)]), "image/png", "a.png"), /MB/); });
t("rejects absurd dimensions", () => bad(() => validateImage(png(20000, 1), "image/png", "a.png"), /o‘lcham/));

console.log("content rendering / XSS");
const html = (s: string) => renderContent(s);
t("paragraphs + single line breaks preserved", () => { const h = html("a\nb\n\nc"); assert.match(h, /<p>a<br \/?>\s*b<\/p>/); assert.match(h, /<p>c<\/p>/); });
t("bold and italic", () => assert.match(html("**x** and *y*"), /<strong>x<\/strong> and <em>y<\/em>/));
t("bare URL becomes external link", () => { const h = html("see https://example.com/a?b=1 now"); assert.match(h, /<a href="https:\/\/example\.com\/a\?b=1" target="_blank" rel="noopener noreferrer nofollow ugc">/); });
t("multiple links in one post", () => assert.equal((html("[a](https://a.com) and [b](https://b.com) https://c.com").match(/<a /g) ?? []).length, 3));
t("trailing punctuation not part of URL", () => assert.match(html("Visit https://example.com."), /href="https:\/\/example\.com"/));
for (const [name, src] of [
  ["script tag", "<script>alert(1)</script>"], ["javascript: link", "[x](javascript:alert(1))"], ["onerror img", '<img src=x onerror="alert(1)">'],
  ["data: link", "[x](data:text/html;base64,PHNjcmlwdD4=)"], ["iframe", '<iframe src="https://evil"></iframe>'], ["onclick attr", '<a href="https://a.com" onclick="x()">t</a>'],
  ["svg onload", "<svg onload=alert(1)>"], ["style tag", "<style>*{display:none}</style>"], ["encoded js url", "[x](&#106;avascript:alert(1))"],
] as const) t(`XSS blocked: ${name}`, () => { const h = html(src); assert.doesNotMatch(h, /<script|<iframe|<svg|<style|onerror|onclick|onload|javascript:|data:text/i); });
t("protocol-relative link dropped", () => assert.doesNotMatch(html("[x](//evil.com)"), /evil\.com/));
t("h1 demoted to h2", () => assert.match(html("# Big"), /<h2>Big<\/h2>/));
t("plainText strips markup + truncates at word", () => { const p = plainText("**Salom** [dunyo](https://a.com) " + "so‘z ".repeat(80), 60); assert.ok(p.length <= 61 && p.endsWith("…") && !/[*\[\]]/.test(p)); });

t("plainText keeps a space across line breaks and paragraphs", () => assert.equal(plainText("bir.\nikki\n\nuch"), "bir. ikki uch"));
t("excerptIsAuto: auto vs hand-written", () => {
  const body = "Birinchi qator.\nIkkinchi qator.\n\n" + "Uzun matn davomi. ".repeat(30);
  assert.equal(excerptIsAuto(plainText(body, 180), body), true);
  assert.equal(excerptIsAuto("Qo‘lda yozilgan qisqa tavsif", body), false);
  assert.equal(excerptIsAuto("", body), true);
});

console.log("dates / slugs / media");
t("date+time use the site zone (Asia/Tashkent = UTC+5), not server zone", () => { const d = new Date("2026-11-17T21:30:00Z"); assert.equal(fmtDate(d), "18-noyabr, 2026"); assert.equal(fmtTime(d), "02:30"); });
t("zonedDayStart", () => assert.equal(zonedDayStart("2026-11-18")!.toISOString(), "2026-11-17T19:00:00.000Z"));
t("zonedDayStart rejects junk", () => assert.equal(zonedDayStart("nope"), null));
t("slugify", () => { assert.equal(slugify("Foydali ma'lumotlar"), "foydali-malumotlar"); assert.equal(slugify("O‘zbekiston g‘alaba!"), "ozbekiston-galaba"); assert.equal(slugify("???"), "post"); });
const M = (o: Partial<Parameters<typeof splitMedia>[0]["media"][number]>) => ({ id: "i", mimeType: "image/png", url: null, isCover: false, order: 0, alt: "", width: 1, height: 1, ...o });
t("cover: flagged > legacy coverUrl > first image; gallery keeps order", () => {
  const a = splitMedia({ title: "T", coverUrl: "https://x/c.jpg", media: [M({ id: "a", order: 1 }), M({ id: "b", order: 0, isCover: true })] });
  assert.equal(a.cover?.src, "/api/media/b"); assert.deepEqual(a.gallery.map((g) => g.src), ["/api/media/a"]);
  assert.equal(splitMedia({ title: "T", coverUrl: "https://x/c.jpg", media: [] }).cover?.src, "https://x/c.jpg");
  const c = splitMedia({ title: "T", coverUrl: null, media: [M({ id: "z", order: 2 }), M({ id: "y", order: 1 })] });
  assert.equal(c.cover?.src, "/api/media/y"); assert.deepEqual(c.gallery.map((g) => g.src), ["/api/media/z"]);
});
t("legacy url-only media still renders", () => assert.equal(splitMedia({ title: "T", coverUrl: null, media: [M({ id: "l", mimeType: null, url: "/uploads/a.jpg" })] }).cover?.src, "/uploads/a.jpg"));

console.log(`\n${n} checks passed${process.exitCode ? " (WITH FAILURES)" : ""}`);
