import { SITE } from "@/lib/util";
export default function robots() { return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }, sitemap: `${SITE}/sitemap.xml` }; }
