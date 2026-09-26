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
  /**
   * A product whose pre-rendered Open Graph card should front this page. The
   * card is keyed by product id and written by `scripts/generate-og.ts`.
   * Omitted pages fall back to the site card.
   */
  cardProductId?: string;
  imageAlt?: string;
};

export const DEFAULT_OG_IMAGE = "/og/default.jpg";

/**
 * Every social card is a pre-rendered 1200x630 landscape, never a raw gallery
 * photograph.
 *
 * Product photography in this catalogue is portrait -- chairs sit between
 * 0.53:1 and 0.74:1 -- and a scraper consuming a 1.91:1 card centre-crops to
 * fit. WhatsApp, which is how most of this audience shares a link, would
 * deliver a chair with its headrest and castors cut off. Handing over a card
 * that is already the right shape removes the scraper's judgement from the
 * loop, and lets the dimensions be declared, which stops it fetching the file
 * just to measure it.
 */
export function ogCardPath(productId: string): string {
  return `/og/products/${productId}.jpg`;
}

export function pageMetadata({
  title,
  description,
  path,
  cardProductId,
  imageAlt,
}: PageSeo): Metadata {
  const url = absoluteUrl(path);
  const ogImage = absoluteUrl(
    cardProductId ? ogCardPath(cardProductId) : DEFAULT_OG_IMAGE,
  );
  const alt = imageAlt ?? `${SITE.name} — ergonomic workspace furniture`;
  const fullTitle = `${title} | ${SITE.name}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      /*
        Kept as "website" even on product pages. Facebook's "product" vertical
        is not in Next's OpenGraph type union, and emitting a second og:type
        through `other` would ship two conflicting tags. The machine-readable
        product description that actually matters is the Product JSON-LD on
        the page itself, which Google reads and Facebook ignores either way.
      */
      type: "website",
      siteName: SITE.name,
      locale: "en_IN",
      title: fullTitle,
      description,
      url,
      images: [{ url: ogImage, width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage],
    },
  };
}
