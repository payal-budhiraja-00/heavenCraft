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
 * The clause every listing description ends with, budget permitting.
 *
 * These four facts are the ones that answer the objection a first-time buyer
 * of a ₹15,000 chair from an unfamiliar brand actually has, and none of them
 * were visible anywhere a search engine could read. Kept short because a meta
 * description is truncated around 160 characters and the product-specific
 * half matters more than this half.
 */
export const TRUST_SUFFIX = "2-year warranty and free assembly.";

/**
 * Joins a page-specific description to a fixed tail without overrunning the
 * ~160 characters a result snippet shows.
 *
 * The tail is the part that must survive, because it is the same on every
 * page and is what gets cut first when the lead is long. So the lead is
 * trimmed to fit around it, at a word boundary, rather than the whole string
 * being chopped and the trust clause lost.
 *
 * Trimming at a word boundary is not enough on its own. A third of the
 * catalogue landed on a function word -- "The headrest moves for height
 * and… 2-year warranty" -- which reads like the sentence was interrupted
 * rather than shortened. Trailing conjunctions, articles and prepositions
 * are therefore dropped too, and if what remains already ends a sentence the
 * ellipsis is left off entirely, because "…" after a full stop is noise.
 */
const DANGLING =
  /\s+(?:and|or|but|with|without|the|a|an|for|to|of|in|on|at|by|as|so|if|is|are|was|were|be|been|that|which|who|from|into|onto|up|down|over|under|its|it|their|there|this|these|those|when|while|than|then)$/i;

export function composeDescription(lead: string, tail = TRUST_SUFFIX): string {
  const LIMIT = 158;
  const room = LIMIT - tail.length - 1;
  if (lead.length <= room) return `${lead} ${tail}`;

  const cut = lead.slice(0, room - 1);
  let trimmed = cut.slice(0, cut.lastIndexOf(" ")).trimEnd();

  /*
    Repeated because one strip can expose another ("for height and the" ->
    "for height and" -> "for height"). Stops short of gutting the sentence:
    below ~40 characters the lead has stopped saying anything useful and a
    dangling word is the lesser problem.
  */
  for (;;) {
    const next = trimmed.replace(DANGLING, "").trimEnd();
    if (next === trimmed || next.length < 40) break;
    trimmed = next;
  }

  if (/[.!?]$/.test(trimmed)) return `${trimmed} ${tail}`;
  return `${trimmed.replace(/[,;:]$/, "")}… ${tail}`;
}

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
