import type { Product } from "./catalog-types";

/**
 * Images that must not be used as a hero, category tile or any other
 * full-bleed placement.
 *
 * These are supplier photographs with someone else's marketing burned into the
 * pixels. They are still legitimate as gallery frames on the product they
 * belong to -- the buyer is looking at that exact product and the context is
 * obvious -- but putting them at hero scale would put a competitor's brand, or
 * a marketing claim HeavenCraft has not verified, at the top of the page.
 */
const NOT_FOR_FEATURE = new Set([
  // "Eureka Ergonomic" wordmark visible on the desk itself.
  "/images/products/tables/gaming-desk/1 - Quantum.jpeg",
  // Marketing overlay text composited into the frame.
  "/images/products/tables/height-adjustable-table/6 - Movix6.jpeg",
]);

export function isFeatureSafe(src: string): boolean {
  return !NOT_FOR_FEATURE.has(src);
}

/**
 * Filenames on disk contain spaces, and two directories are mixed-case. The
 * origin is case-sensitive Apache, so the path is passed through exactly as
 * recorded and only percent-encoded.
 */
export function encodeImagePath(src: string): string {
  return src.split("/").map(encodeURIComponent).join("/");
}

/** First image safe to show at large scale, else the first image at all. */
export function featureImage(product: Product): string | undefined {
  return product.images.find(isFeatureSafe) ?? product.images[0];
}

/** The card image: same rule, since cards render large on mobile. */
export function cardImage(product: Product): string | undefined {
  return featureImage(product);
}

/**
 * Alt text is generated from the product, never left empty and never set to
 * the filename. Decorative duplicates inside a gallery are numbered so a
 * screen reader user can tell one thumbnail from another.
 */
export function imageAlt(product: Product, index = 0): string {
  return index === 0
    ? `${product.name} — ${product.subName.replace(/s$/, "").toLowerCase()} by HeavenCraft`
    : `${product.name}, view ${index + 1}`;
}
