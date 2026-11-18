import "./globals.css";
import type { Metadata } from "next";
import { Inter_Tight, Source_Serif_4 } from "next/font/google";
import { SITE } from "@/lib/util";
import { BRAND, TAGLINE } from "@/lib/constants";

const display = Inter_Tight({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--f-display", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin", "latin-ext", "cyrillic"], style: ["normal", "italic"], variable: "--f-serif", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: `${BRAND} — kitoblar, texnologiya va o‘z ustida ishlash`, template: `%s — ${BRAND}` },
  description: TAGLINE,
  openGraph: { siteName: BRAND, locale: "uz_UZ", type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="uz" className={`${display.variable} ${serif.variable}`}><body>{children}</body></html>;
}
