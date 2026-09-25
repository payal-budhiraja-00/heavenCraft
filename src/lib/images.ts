import type { Product } from "./catalog-types";

/**
 * Products that must not be used as a hero, category tile or any other
 * full-bleed placement.
 *
 * ## Why this is now keyed by product rather than by image path
 *
 * The September 2026 photography is supplier-shot lifestyle imagery, and
 * nearly every frame in it contains styled set dressing: wall posters reading
 * "Good Work Better Days", notebooks reading "Big Ideas Start Somewhere",
 * printed mugs. The previous version of this list named individual files as
 * carrying "marketing overlay text", and applying that standard to the new
 * set would disqualify almost all of it.
 *
 * So the rule is narrowed to the thing that actually creates exposure: a
 * third party's trademark. A slogan on a prop is set dressing and makes no
 * claim about the furniture. A competitor's wordmark, or a Coca-Cola can, is
 * someone else's mark rendered at hero scale on our homepage.
 *
 * It is keyed by product because the one offender carries its maker's
 * wordmark moulded into the desk leg, so every frame of it shows the mark and
 * no per-file list could ever be complete.
 *
 * These products are still shown on their own page and on their own card --
 * the buyer is looking at that exact item and the context is obvious.
 */
const NOT_FOR_FEATURE = new Set<string>([
  // Another manufacturer's wordmark is printed down the desk leg in every
  // frame, and frame 1 also stages a branded soft-drink can.
  "table-gaming-desk-001",
  // Same: a maker's wordmark on the leg, plus a branded coffee cup.
  "phantom-gaming-desk",
]);

export function isFeatureSafe(product: Product): boolean {
  return !NOT_FOR_FEATURE.has(product.id);
}

/**
 * Filenames on disk contain spaces, and two directories are mixed-case. The
 * origin is case-sensitive Apache, so the path is passed through exactly as
 * recorded and only percent-encoded.
 */
export function encodeImagePath(src: string): string {
  return src.split("/").map(encodeURIComponent).join("/");
}

/**
 * Image for a large placement, or undefined when this product may not take
 * one. Callers that pick a "lead" product for a hero use that undefined to
 * skip past it to the next candidate.
 */
export function featureImage(product: Product): string | undefined {
  return isFeatureSafe(product) ? product.images[0] : undefined;
}

/**
 * The card image. Falls back to the first frame even for a product barred
 * from feature placements: a product card with no photograph is worse than
 * one showing the item as the supplier shot it.
 */
export function cardImage(product: Product): string | undefined {
  return featureImage(product) ?? product.images[0];
}

/**
 * Alt text is generated from the product, never left empty and never set to
 * the filename. Decorative duplicates inside a gallery are numbered so a
 * screen reader user can tell one thumbnail from another.
 */
/**
 * Alt text is generated from the product, never left empty and never set to
 * the filename. Decorative duplicates inside a gallery are numbered so a
 * screen reader user can tell one thumbnail from another.
 *
 * `colour` is passed only for products sold in more than one finish. Without
 * it, the eight frames of a chair sold in black and white read as one
 * undifferentiated run of "view 2, view 3, view 4" -- which withholds exactly
 * the thing those photographs differ in.
 */
export function imageAlt(product: Product, index = 0, colour?: string): string {
  const name = colour ? `${product.name} in ${colour}` : product.name;

  return index === 0
    ? `${name} — ${product.subName.replace(/s$/, "").toLowerCase()} by HeavenCraft`
    : `${name}, view ${index + 1}`;
}
