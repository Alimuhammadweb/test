// Helpers for turning stored media rows into something renderable.
export type MediaRef = { id: string; mimeType: string | null; url: string | null; isCover: boolean; order: number; alt: string; width: number | null; height: number | null };
export type Img = { src: string; alt: string; width: number | null; height: number | null; stored: boolean };

export const mediaPath = (id: string) => `/api/media/${id}`;

function toImg(m: MediaRef, fallbackAlt: string): Img | null {
  if (m.mimeType) return { src: mediaPath(m.id), alt: m.alt || fallbackAlt, width: m.width, height: m.height, stored: true };
  if (m.url) return { src: m.url, alt: m.alt || fallbackAlt, width: null, height: null, stored: false };
  return null;
}

/**
 * Cover = image flagged as cover, else the legacy coverUrl, else the first image.
 * Gallery = every other image, in the author's order.
 */
export function splitMedia(post: { title: string; coverUrl: string | null; media: MediaRef[] }) {
  const all = [...post.media].sort((a, b) => a.order - b.order);
  const flagged = all.find((m) => m.isCover);
  let cover: Img | null = null;
  let rest = all;
  if (flagged) { cover = toImg(flagged, post.title); rest = all.filter((m) => m !== flagged); }
  else if (post.coverUrl) cover = { src: post.coverUrl, alt: post.title, width: null, height: null, stored: false };
  else if (all.length) { cover = toImg(all[0], post.title); rest = all.slice(1); }
  const gallery = rest.map((m, i) => toImg(m, `${post.title} — rasm ${i + 1}`)).filter((x): x is Img => !!x);
  return { cover, gallery };
}
