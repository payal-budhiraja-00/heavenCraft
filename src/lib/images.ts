import imageFocusMap from "../data/image-focus.json";
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

type ImageEntry = { ar: number; pos?: string };

const IMAGE_DATA = imageFocusMap as Record<string, ImageEntry>;

/**
 * Where the furniture sits inside a photograph, as a CSS `object-position`.
 *
 * Every card and tile crops its photograph to fill a fixed box. Cropping from
 * the middle assumes the product is in the middle, and the supplier's studio
 * frames leave a lot of empty backdrop above a chair's headrest, so a centred
 * crop drifted down into the floor.
 *
 * `scripts/generate-focus.ts` measures each file and records the ones that
 * need moving; anything it leaves out is already centred well enough.
 */
export function imageFocus(src: string): string {
  return IMAGE_DATA[src]?.pos ?? "50% 50%";
}

/**
 * The shape of box a set of products should be shown in.
 *
 * ## Why this is measured rather than declared
 *
 * The supplier shot the range in wildly different orientations -- chairs
 * upright at about 0.6:1, room shots of the executive tables at about 1.6:1 --
 * and pouring that into one fixed box is what made the old tiles look wrong.
 * There is no single ratio that a chair and a desk both sit in comfortably.
 *
 * A ratio per category is not true either: the tables hold both a 0.73:1
 * gaming desk shot upright and a 1.6:1 executive table shot across the room,
 * so "tables are landscape" mis-crops the desk as badly as one global ratio.
 *
 * So the box is chosen from the photographs actually in the grid, from a
 * short list of stops -- an arbitrary decimal would give every page a
 * slightly different and faintly wrong shape.
 *
 * ## Why the choice is a compromise, and how it is struck
 *
 * Three objectives were tried against the real catalogue. Snapping to the
 * median ratio suits the majority but cut 44% off the two tables that happen
 * to be shot upright. Maximising the worst card's share rescued those two and
 * pushed eight others below 70% -- it traded ten good cards for two.
 *
 * What is used is least squares on the discarded fraction: the stop that
 * minimises the mean squared loss. Halving one photograph counts for four
 * times as much as trimming a tenth off four of them, so the majority still
 * decides the shape while a card that would look broken can still veto it.
 *
 * The obvious alternative -- pick a better-fitting frame from the same
 * product -- is done, but only from a checked list. See `CARD_FRAME`.
 */
const ASPECT_STOPS: Array<[ratio: number, className: string]> = [
  [4 / 5, "aspect-4/5"],
  [1, "aspect-square"],
  [4 / 3, "aspect-4/3"],
];

const FALLBACK_ASPECT = "aspect-square";

/** Fraction of a photograph that survives being cropped to fill `boxAr`. */
function retained(sourceAr: number, boxAr: number): number {
  return Math.min(sourceAr, boxAr) / Math.max(sourceAr, boxAr);
}

export function gridAspect(products: Product[]): string {
  const ratios = products
    .map((p) => cardImage(p))
    .map((src) => (src ? IMAGE_DATA[src]?.ar : undefined))
    .filter((ar): ar is number => typeof ar === "number");

  if (ratios.length === 0) return FALLBACK_ASPECT;

  let best = FALLBACK_ASPECT;
  let bestLoss = Infinity;

  for (const [ratio, className] of ASPECT_STOPS) {
    const loss =
      ratios.reduce((total, ar) => total + (1 - retained(ar, ratio)) ** 2, 0) /
      ratios.length;

    if (loss < bestLoss) {
      bestLoss = loss;
      best = className;
    }
  }

  return best;
}

/**
 * Products whose supplier ordering puts a poor lead frame first, and the
 * frame to use for cards and tiles instead.
 *
 * ## Why this is a hand-written list
 *
 * Choosing the frame whose shape best fits the grid would be the obvious
 * automatic rule, and it is the wrong one: the widest frame of nearly every
 * product in this catalogue is its marketing infographic or a dimension
 * drawing, so "widest" reliably selects a poster rather than a photograph.
 * Both entries below were checked by eye.
 *
 * Only products whose first frame is a genuine outlier are listed. Two tables
 * are shot upright while the rest of the range is shot across the room, so
 * they were the two cards being cropped hardest on the tables page.
 *
 * The index is looked up defensively: if the catalogue is replaced and the
 * frame is gone, the card falls back to the supplier's first frame, which is
 * merely the old behaviour rather than a broken page.
 */
const CARD_FRAME: Record<string, number> = {
  // Frame 1 is the table folded flat against a wall and frame 4 is a feature
  // poster. Frame 2 is the only wide frame showing it open and in use.
  "flex-apex-bed-table": 2,
  // The supplier's first frame is a tight upright crop. Frame 1 is the full
  // desk shot across the room and happens to be an exact 4:3.
  "table-gaming-desk-001": 1,
  // The narrowest frame in the catalogue at 0.53:1, against 0.6-0.67 for the
  // other five chairs. Frame 1 is the same chair in the same upright pose,
  // shot wider, so the range still reads as one set.
  "chair-mesh-006": 1,
};

function leadFrame(product: Product): string | undefined {
  const preferred = CARD_FRAME[product.id];
  if (preferred !== undefined) {
    const chosen = product.images[preferred];
    if (chosen) return chosen;
  }
  return product.images[0];
}

/**
 * Image for a large placement, or undefined when this product may not take
 * one. Callers that pick a "lead" product for a hero use that undefined to
 * skip past it to the next candidate.
 */
export function featureImage(product: Product): string | undefined {
  return isFeatureSafe(product) ? leadFrame(product) : undefined;
}

/**
 * The card image. Falls back to the first frame even for a product barred
 * from feature placements: a product card with no photograph is worse than
 * one showing the item as the supplier shot it.
 */
export function cardImage(product: Product): string | undefined {
  return featureImage(product) ?? leadFrame(product);
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
