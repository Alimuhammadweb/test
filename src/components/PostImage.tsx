import Image from "next/image";
import type { Img } from "@/lib/media";

type Props = { img: Img; sizes: string; priority?: boolean; fill?: boolean; className?: string };

/** Images stored in PostgreSQL go through the Next.js image optimizer (resized WebP, cached). Legacy URL images render as-is. */
export function PostImage({ img, sizes, priority, fill, className = "" }: Props) {
  if (img.stored) {
    return fill
      ? <Image src={img.src} alt={img.alt} fill sizes={sizes} priority={priority} className={className} />
      : <Image src={img.src} alt={img.alt} width={img.width ?? 1200} height={img.height ?? 800} sizes={sizes} priority={priority} className={className} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={img.src} alt={img.alt} loading={priority ? "eager" : "lazy"} decoding="async" className={fill ? `absolute inset-0 w-full h-full ${className}` : className} />;
}
