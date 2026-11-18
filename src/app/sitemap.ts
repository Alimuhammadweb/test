import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { live, SITE } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, cats] = await Promise.all([
    db.post.findMany({ where: live(), select: { slug: true, updatedAt: true }, orderBy: { publishedAt: "desc" } }),
    db.category.findMany({ select: { slug: true } }),
  ]);
  return [
    { url: SITE }, { url: `${SITE}/posts` },
    ...cats.map((c) => ({ url: `${SITE}/kategoriya/${c.slug}` })),
    ...posts.map((p) => ({ url: `${SITE}/posts/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
