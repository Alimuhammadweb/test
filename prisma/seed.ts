import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
const slug = (s: string) => s.toLowerCase().replace(/[ʻʼ’‘`'´]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const cats = ["Shaxsiy rivojlanish", "Kitoblar", "Loyihalarim", "IT va texnologiya", "Foydali ma'lumotlar", "Fikrlarim"];
const samples: [string, string[], string][] = [
  ["Kuniga yigirma bet: kitob o‘qish odati", ["Kitoblar", "Shaxsiy rivojlanish"], "Katta kitoblar kichik, takrorlanadigan qadamdan tugaydi."],
  ["Birinchi loyiham: nimani o‘rgandim", ["Loyihalarim", "IT va texnologiya"], "Ishga tushirish va xato qilish haqida qisqa mulohaza."],
  ["Telefonni uyqudan oldin qo‘yib ko‘ring", ["Fikrlarim"], "Kechki odatlar ertangi kunni belgilaydi."],
];

(async () => {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error(".env faylida ADMIN_EMAIL va ADMIN_PASSWORD bo‘lishi kerak");
  const demo = process.argv.includes("--demo");
  await db.adminUser.upsert({ where: { email: process.env.ADMIN_EMAIL }, update: {}, create: { email: process.env.ADMIN_EMAIL, passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12) } });
  // Idempotent: existing categories (matched by slug) are left untouched.
  for (const [i, n] of cats.entries()) await db.category.upsert({ where: { slug: slug(n) }, update: {}, create: { name: n, slug: slug(n), sortOrder: i + 1 } });
  if (demo) for (const [i, [title, cs, ex]] of samples.entries()) {
    await db.post.upsert({ where: { slug: slug(title) }, update: {}, create: {
      title: "[Namuna] " + title, slug: slug(title), excerpt: ex, isSample: true, status: "PUBLISHED", publishedAt: new Date(Date.now() - i * 864e5),
      content: `${ex}\n\n## Asosiy fikr\n\nBu — **namunaviy** matn. Uni admin panelidan o‘chirib, haqiqiy yozuvlar qo‘shing.\nHavola: https://example.com\n\n- Birinchi band\n- Ikkinchi band\n\n> Odat — har kuni qilinadigan kichik tanlov.`,
      categories: { create: cs.map((c) => ({ category: { connect: { slug: slug(c) } } })) },
    } });
  }
  console.log(demo ? "Admin, kategoriyalar va namunaviy kontent tayyor" : "Admin va kategoriyalar tayyor");
  await db.$disconnect();
})();
