import { IMAGE_EXTENSIONS, MAX_IMAGE_BYTES, MAX_IMAGE_SIDE, type ImageMime } from "./constants";

export type ImageInfo = { mime: ImageMime; ext: string; width: number; height: number };
export class ImageError extends Error {}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf: Buffer, start: number, end: number) {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function png(b: Buffer) {
  if (b.length < 33 || b.readUInt32BE(8) !== 13 || b.toString("latin1", 12, 16) !== "IHDR") throw new ImageError("PNG sarlavhasi buzilgan");
  const width = b.readUInt32BE(16), height = b.readUInt32BE(20);
  let i = 8, sawIdat = false, sawIend = false;
  while (i + 12 <= b.length) { // verify every chunk: length fits, CRC matches
    const len = b.readUInt32BE(i), type = b.toString("latin1", i + 4, i + 8), end = i + 8 + len;
    if (end + 4 > b.length) throw new ImageError("PNG fayl to‘liq emas");
    if (b.readUInt32BE(end) !== crc32(b, i + 4, end)) throw new ImageError("PNG fayl buzilgan (CRC)");
    if (type === "IDAT") sawIdat = true;
    i = end + 4;
    if (type === "IEND") { sawIend = true; break; }
  }
  if (!sawIdat || !sawIend) throw new ImageError("PNG fayl to‘liq emas");
  return { width, height };
}

function jpeg(b: Buffer) {
  let i = 2, width = 0, height = 0, sos = -1;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new ImageError("JPEG tuzilmasi buzilgan");
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > b.length) throw new ImageError("JPEG fayl to‘liq emas");
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { height = b.readUInt16BE(i + 5); width = b.readUInt16BE(i + 7); }
    if (m === 0xda) { sos = i; break; }
    i += 2 + len;
  }
  if (!width || !height || sos < 0) throw new ImageError("JPEG o‘lchamini aniqlab bo‘lmadi");
  if (b.lastIndexOf(Buffer.from([0xff, 0xd9])) < sos) throw new ImageError("JPEG fayl to‘liq emas");
  return { width, height };
}

function webp(b: Buffer) {
  if (b.length < 30 || b.readUInt32LE(4) + 8 > b.length) throw new ImageError("WebP fayl to‘liq emas");
  const kind = b.toString("latin1", 12, 16);
  if (kind === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (kind === "VP8L" && b[20] === 0x2f) { const v = b.readUInt32LE(21); return { width: (v & 0x3fff) + 1, height: ((v >>> 14) & 0x3fff) + 1 }; }
  if (kind === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  throw new ImageError("WebP tuzilmasi buzilgan");
}

/**
 * Validates an uploaded image: size, real file type (magic bytes, not just the browser-supplied
 * MIME), extension/MIME agreement, structural integrity and sane dimensions.
 * This checks the file structure; it does not decode pixels.
 */
export function validateImage(buf: Buffer, declaredMime: string, filename: string): ImageInfo {
  if (!buf.length) throw new ImageError("Fayl bo‘sh");
  if (buf.length > MAX_IMAGE_BYTES) throw new ImageError(`Rasm ${MAX_IMAGE_BYTES / 1048576} MB dan oshmasligi kerak`);
  let mime: ImageMime;
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) mime = "image/jpeg";
  else if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) mime = "image/png";
  else if (buf.length > 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") mime = "image/webp";
  else throw new ImageError("Faqat JPEG, PNG yoki WebP rasmlari qabul qilinadi");
  if (declaredMime !== mime) throw new ImageError("Fayl turi e’lon qilingan turga mos emas");
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!IMAGE_EXTENSIONS[mime].includes(ext)) throw new ImageError("Fayl kengaytmasi rasm turiga mos emas");
  const { width, height } = mime === "image/png" ? png(buf) : mime === "image/jpeg" ? jpeg(buf) : webp(buf);
  if (!width || !height || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE) throw new ImageError("Rasm o‘lchami yaroqsiz");
  return { mime, ext, width, height };
}

export function safeFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "image";
  return base.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").trim().slice(-120) || "image";
}
