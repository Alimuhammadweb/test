# Just Mind

Shaxsiy nashr platformasi: kitoblar, texnologiya, loyihalar va o‘z ustida ishlash haqidagi yozuvlar.
Next.js 15 (App Router) · React 19 · Prisma 6 · PostgreSQL · Tailwind 3.

Telegram boti yoki Telegram integratsiyasi **yo‘q** — bu loyiha faqat veb-sayt, ma’lumotlar bazasi, admin panel va API.

---

## 1. What changed (summary)

| Area | Before | Now |
|---|---|---|
| Categories | one per post | **many-to-many** (`PostCategory`); admin CRUD page; unique slugs; category pages with pagination, SEO, empty states |
| Images | URL strings; files in `public/uploads` (lost on Vercel) | **bytes stored in PostgreSQL** (`Media.data`, BYTEA), served by `/api/media/[id]`; cover, gallery, ordering, replace, delete, preview |
| Editor | plain form | client editor: formatting toolbar, live (server-rendered) preview, multi-select category pills, image manager, draft/publish/schedule |
| Content | Markdown + sanitizer | same idea, hardened: single line breaks kept, bare URLs auto-linked, external links `target=_blank rel="noopener noreferrer nofollow ugc"`, strict allow-list |
| Dates | server-local time (wrong on Vercel/UTC) | `Intl` in `SITE_TIMEZONE` (default `Asia/Tashkent`); date **and** time on cards and articles |
| Design | Just Habits branding | Just Mind: editorial layout, heavy display headlines (Inter Tight) + serif reading column (Source Serif 4), highlighter-style category labels |
| Bugs fixed | – | re-publishing reset the publish date; soft-404s; login form lost the email; publish date truncated to minutes on every edit; date filters crashed on bad input |

Preserved: `AdminUser`, `Post`, `Category`, `Tag`, `PostView`, all slugs, existing URLs (`/posts/[slug]`, `/kategoriya/[slug]`, `/posts?…`), tags, view counting, sitemap/robots, `POST /api/posts`.

## 2. Setup

```bash
cp .env.example .env        # fill in values
npm install                 # runs prisma generate
npx prisma migrate deploy   # see section 4 for an EXISTING database
npm run db:admin            # creates the admin user + the 6 initial categories (idempotent)
npm run dev
```

### Environment variables
| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SESSION_SECRET` | yes (16+ chars, use 32+) | signs the admin cookie. **Changing it logs the admin out** |
| `SITE_URL` | yes in production | canonical URLs, sitemap, Open Graph (no trailing `/`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | for `npm run db:admin` | admin account |
| `SITE_TIMEZONE` | no (`Asia/Tashkent`) | time zone used to display publication times |
| `API_TOKEN` | no | enables `POST /api/posts` (16+ chars). Unset = endpoint disabled |

The admin cookie was renamed `jh_admin` → `jm_admin`; you will have to log in once after deploying.

## 3. Database schema (Prisma)

See `prisma/schema.prisma`. Key parts:

```prisma
model Category { id name(unique) slug(unique) description sortOrder posts PostCategory[] }
model PostCategory { postId categoryId  @@id([postId, categoryId])  @@index([categoryId]) }   // cascade both ways
model Post { …  coverUrl String? /*legacy*/  categories PostCategory[]  media Media[] … }
enum MediaType { IMAGE }
model Media {
  id postId type(IMAGE) data Bytes? mimeType? filename? size width? height?
  alt order isCover url String? /*legacy URL-only rows*/ createdAt
  @@index([postId, order])
}
```

`data` is nullable only so that **pre-existing URL-only rows stay valid**; every new upload has bytes, mime type, size and dimensions.
`src/lib/db.ts` configures Prisma with a global `omit: { media: { data: true } }`, so *no* query loads image bytes unless it explicitly asks (only `/api/media/[id]` does).

## 4. Applying the migration to your EXISTING database

Your database was created with `prisma db push`, so it has no migration history. The repo now contains:

* `0_init` — baseline = your **old** schema (never executed on your DB, only recorded as applied)
* `20261117000000_just_mind` — the upgrade (non-destructive, runs as one transaction)

```bash
# 0. BACKUP FIRST
pg_dump "$DATABASE_URL" -Fc -f justmind-before-upgrade.dump

# 1. tell Prisma the old schema is already in place
npx prisma migrate resolve --applied 0_init

# 2. apply the upgrade
npx prisma migrate deploy

# 3. initial categories + admin (safe to re-run; never overwrites existing rows)
npm run db:admin

# 4. optional drift check — should print "No difference detected"
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
```

What the migration does: copies every `Post.categoryId` into `PostCategory` **then verifies the counts match before dropping the old column** (it aborts and rolls back otherwise); widens `Media`; keeps all posts, slugs, views, tags and statuses; adds the six initial categories only if their name/slug don’t already exist (an existing "Shaxsiy rivojlanish" is kept, not duplicated).

Restoring: `pg_restore -c -d "$DATABASE_URL" justmind-before-upgrade.dump`.

**Old images** uploaded as files (`/uploads/…`): run `npm run db:legacy-images` where the old `public/uploads` folder exists. It validates each file, stores it in PostgreSQL, converts a legacy `coverUrl` into a real cover image, skips missing/invalid/external URLs, and is idempotent. Rows left as URLs keep rendering as before.

## 5. How image upload works (and why it works on Vercel)

Vercel rejects request bodies above ~4.5 MB, so a "send everything in one form" design fails in production. Instead:

1. The browser compresses large photos (>1.5 MB or >2560 px → WebP, max 2560 px; this also strips EXIF/GPS) and shows a preview.
2. The post is saved first (`savePost` server action — JSON only).
3. Each image is then sent in **its own request** to `POST /api/admin/posts/[id]/media` (limit 4 MB each), with a per-image status and retry.
4. Publishing a not-yet-live post with images is two-phase (save as draft → upload → publish) so visitors never see it half-built.

Server-side validation (never trusts the browser): size, magic bytes (real JPEG/PNG/WebP), declared MIME vs real type, extension vs type, structural integrity (PNG chunk CRCs, JPEG markers/EOI, WebP RIFF header), sane dimensions, max 20 images per post, sanitized filename. This validates file structure; it does not decode pixels.

Serving: `/api/media/[id]` — published posts: `Cache-Control: public, max-age=604800, immutable` + `ETag`/304; drafts/scheduled: admin only, `no-store`. Replacing an image creates a **new id**, which is why immutable caching is safe. Pages show images through `next/image` (resized WebP, lazy-loaded below the fold, cover/first cards preloaded).

## 6. Writing content

Blank line = new paragraph, Enter = line break. `**bold**`, `*italic*`, `## heading`, `- list`, `> quote`, `[text](https://…)`, and plain `https://…` links become clickable automatically. Raw HTML, scripts, `javascript:` URLs, iframes, event handlers are removed.

## 7. Website routes
`/` · `/posts` (search, category, date range, sort, pagination; `?sahifa=n`) · `/posts/[slug]` · `/kategoriya/[slug]` · `/sitemap.xml` · `/robots.txt`
Admin (cookie session, noindex): `/admin` · `/admin/posts/new` · `/admin/posts/[id]` · `/admin/categories` · `/admin/login`

## 8. API reference

| Method & path | Auth | Description |
|---|---|---|
| `GET /api/media/[id]` | public for published posts; admin for drafts | Image bytes. `200`, `304`, `404` |
| `POST /api/admin/posts/[id]/media` | admin cookie + same-origin | multipart: `file` (required), `order`, `alt`, `isCover=true`. `201 {id,src,order,isCover,width,height}`; `401`, `403`, `404`, `413`, `422 {error}` (invalid image / too many), `500` |
| `POST /api/admin/preview` | admin cookie + same-origin | JSON `{content}` → `{html}` (sanitized, same renderer as the site) |
| `POST /api/posts` | `Authorization: Bearer $API_TOKEN` | JSON: `title`, `content` (required); `excerpt`, `categories[]` or `category`, `tags[]`, `images[]`/`image_url` (URLs), `source_url`, `published_at` (ISO), `status` (`draft`\|`published`), `external_id`/`Idempotency-Key`. `201 {id,slug,status}`, `401`, `409` (duplicate), `422` |

Post/category create-edit-delete in the admin panel use Next.js server actions (`src/app/admin/actions.ts`), protected by `requireAdmin()` and Zod validation.

## 9. Deploying to Vercel
1. Provision PostgreSQL (Neon, Supabase, Vercel Postgres…). Use the **pooled** URL for `DATABASE_URL` if the provider offers one.
2. Set the env vars from section 2 in the Vercel project.
3. Run section 4 once against the production database (from your machine with `DATABASE_URL` pointing at it).
4. Deploy. The build script is `prisma generate && next build`; **the build does not need database access**. Optionally set the build command to `prisma generate && prisma migrate deploy && next build` to auto-migrate on each deploy.
5. Check: log in, create a post with 2–3 photos, open it on your phone, redeploy, confirm the images still load (they live in PostgreSQL, not on the server disk).

Mind the database size: ~2 MB per photo × many posts adds up. Check your plan’s storage limit.

## 10. Tests

```bash
npm run typecheck
npm run test:unit        # 37 checks: image validation, XSS vectors, dates/time zone, slugs, cover logic
```
`tests/e2e/` holds the Playwright (Python) browser suite and fixture generator that were used to verify this release against a real PostgreSQL (paths/credentials at the top of `run.py` are for my environment; adjust before reuse).

## 11. Known limitations
* Image bytes in PostgreSQL grow the database and its backups; there is no thumbnail table (the Next.js optimizer produces and caches sized variants; on Vercel its usage counts toward your plan).
* Reordering uses Up/Down buttons (no drag-and-drop).
* Uploads are one request per image; if the connection drops mid-way the post is saved and failed images show a retry error.
* An image unpublished after being cached by a CDN/browser can remain cached for up to 7 days.
* Article pages are server-rendered per request (they count views); the home/list pages are dynamic too. Only images are cached long-term.
* Login has a small delay on failure but no IP rate limiting. Put the site behind your host’s WAF/rate limit if exposed to abuse.
* Content uses Markdown-lite, not a WYSIWYG editor. Bare domains without `https://` (e.g. `example.com`) are not auto-linked.
* A single admin account type; no roles.
* The Telegram share link was removed from the article page (X, Facebook, LinkedIn remain).
