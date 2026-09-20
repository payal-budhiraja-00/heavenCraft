import type { Metadata } from "next";
import { SITE, absoluteUrl } from "@/lib/site";

/**
 * Next does not deep-merge `openGraph`: a page that declares its own object
 * replaces the layout's entirely, silently dropping `images`, `siteName` and
 * `locale`. Every page therefore builds its metadata through here so the
 * social card can never go missing again.
 */
export type PageSeo = {
  title: string;
  description: string;
  /** Root-relative, with trailing slash, e.g. "/chairs/mesh-chair/". */
  path: string;
  /** Absolute or root-relative image URL. Falls back to the site OG card. */
  image?: string;
  imageAlt?: string;
};

export const DEFAULT_OG_IMAGE = "/og/default.png";

export function pageMetadata({
  title,
  description,
  path,
  image,
  imageAlt,
}: PageSeo): Metadata {
  const url = absoluteUrl(path);
  const usingDefault = !image;
  const ogImage = absoluteUrl(image ?? DEFAULT_OG_IMAGE);
  const alt = imageAlt ?? `${SITE.name} — ergonomic workspace furniture`;
  const fullTitle = `${title} | ${SITE.name}`;

  // Dimensions are only declared for the generated card, whose size we know.
  // Product photographs vary, and a wrong hint makes scrapers crop badly.
  const ogImageEntry = usingDefault
    ? { url: ogImage, width: 1200, height: 630, alt }
    : { url: ogImage, alt };

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: "en_IN",
      title: fullTitle,
      description,
      url,
      images: [ogImageEntry],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage],
    },
  };
}
