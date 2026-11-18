import { Prisma } from "@prisma/client";
import { cache } from "react";
import { db } from "./db";
import { live } from "./util";

const categoryOrder = [{ category: { sortOrder: "asc" } }, { category: { name: "asc" } }] satisfies Prisma.PostCategoryOrderByWithRelationInput[];
const mediaSelect = { id: true, mimeType: true, url: true, isCover: true, order: true, alt: true, width: true, height: true } as const;

/** Everything a post card needs. No content body and no binary data. */
export const cardArgs = {
  select: {
    id: true, title: true, slug: true, excerpt: true, coverUrl: true, publishedAt: true,
    categories: { select: { category: { select: { id: true, name: true, slug: true } } }, orderBy: categoryOrder },
    media: { select: mediaSelect, orderBy: { order: "asc" } },
  },
} satisfies Prisma.PostDefaultArgs;
export type PostCardData = Prisma.PostGetPayload<typeof cardArgs>;

export const articleArgs = {
  select: {
    ...cardArgs.select, content: true, sourceUrl: true, views: true, updatedAt: true,
    tags: { select: { id: true, name: true } },
  },
} satisfies Prisma.PostDefaultArgs;

export const categoryNav = cache(() =>
  db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true } }));

export const getCategory = cache((slug: string) => db.category.findUnique({ where: { slug } }));

export const getArticle = cache((slug: string) =>
  db.post.findFirst({ where: { slug, ...live() }, ...articleArgs }));

export function relatedPosts(postId: string, categoryIds: string[]) {
  if (!categoryIds.length) return Promise.resolve([] as PostCardData[]);
  return db.post.findMany({
    where: { ...live(), id: { not: postId }, categories: { some: { categoryId: { in: categoryIds } } } },
    orderBy: { publishedAt: "desc" }, take: 3, ...cardArgs,
  });
}
