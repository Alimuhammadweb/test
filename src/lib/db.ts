import { PrismaClient } from "@prisma/client";

// Image bytes (Media.data) are omitted from EVERY query by default so list pages and
// post queries never pull binary data. Only GET /api/media/[id] asks for it explicitly
// with `omit: { data: false }`.
const make = () => new PrismaClient({ omit: { media: { data: true } } });
const g = globalThis as unknown as { p?: ReturnType<typeof make> };
export const db = g.p ?? make();
if (process.env.NODE_ENV !== "production") g.p = db;
