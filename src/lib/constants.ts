// Shared by server and client code. Keep this file free of server-only imports.
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];
export const IMAGE_EXTENSIONS: Record<ImageMime, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};
// Vercel rejects request bodies above ~4.5 MB, so every image is uploaded in its own request
// and must stay below this limit (the browser compresses larger photos before uploading).
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 12000;
export const MAX_IMAGES_PER_POST = 20;
export const PAGE_SIZE = 9;
export const BRAND = "Just Mind";
export const TAGLINE = "Kitoblar, texnologiya, loyihalar va o‘z ustida ishlash haqida yozuvlar.";
