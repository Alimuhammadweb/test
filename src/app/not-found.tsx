import type { Metadata } from "next";
import { Header, Footer } from "@/components/Shell";
import { EmptyState } from "@/components/Ui";

export const metadata: Metadata = { title: "Sahifa topilmadi", robots: { index: false } };

export default function NotFound() {
  return (<><Header bare /><main className="mx-auto max-w-6xl px-5 pt-16">
    <EmptyState title="Sahifa topilmadi" text="Havola noto‘g‘ri yoki yozuv o‘chirilgan bo‘lishi mumkin." action={{ href: "/posts", label: "Barcha yozuvlar" }} />
  </main><Footer bare /></>);
}
