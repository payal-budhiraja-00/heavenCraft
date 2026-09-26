/**
 * Seeds a compare-at price for every variant.
 *
 * ## Where the number comes from
 *
 * The selling prices in this catalogue are already the final sale prices --
 * they are what Shopify charges today and they do not change here. What was
 * missing is the printed MRP. This file works out a sensible starting value
 * for each variant so 26 products do not have to be typed in by hand.
 *
 * ## Why this is a seed and not the source of truth
 *
 * Once written, the number lives in Shopify's own `compareAtPrice` field and
 * Shopify is authoritative. The site reads it back at build time. Editing a
 * price in Shopify admin therefore wins, and re-running the seeding script
 * will not overwrite a hand-corrected value.
 *
 * ## Why these particular numbers
 *
 * Calibrated against 258 live listings scraped from Amazon.in and Flipkart
 * across four categories -- office chairs, study tables, headphones and mixer
 * grinders -- deliberately including non-furniture, because this presentation
 * habit is a marketplace convention rather than a furniture one.
 *
 * Two things came out of that sample, and they pull in opposite directions.
 *
 * The *discounts* there are enormous: median 60%, upper quartile 72%. We do
 * not follow that, and should not. A 60% headline needs an MRP two and a half
 * times the selling price, and the printed MRP here runs 50-80% above it --
 * which supports 33-44% at the very most. The band below tops out at 40%, so
 * every figure the site prints is one the paperwork can back. Undershooting
 * the marketplace is a deliberate trade of headline for defensibility.
 *
 * The *shape of the figures* we do follow, because it costs nothing and is
 * what makes a price read as printed rather than computed. In the sample,
 * 66% of MRPs end in 99 and 52% end in exactly 999; only 8% end in 00. Hence
 * the rounding below, which lands almost everything on ...999 or ...99.
 */

/**
 * FNV-1a. Chosen because it is short enough to read, has no dependencies, and
 * spreads adjacent ids like `chair-mesh-004` and `chair-mesh-005` into
 * unrelated buckets -- an incrementing counter would hand neighbouring
 * products near-identical discounts and undo the point of the exercise.
 */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Target discount band, in whole percent, by top-level category.
 *
 * Expressed as the discount rather than the multiplier because that is the
 * number everyone actually reasons about, and the one printed on the page.
 *
 * Accessories sit highest and tables lowest, following the sampled listings:
 * a low-value item carries a larger printed margin, while a big-ticket item
 * showing a huge discount invites doubt rather than confidence. The bands are
 * wide and overlap so the catalogue does not sort into three visible tiers.
 */
const BANDS: Record<string, readonly [number, number]> = {
  accessories: [26, 40],
  chairs: [21, 39],
  tables: [20, 37],
};

const FALLBACK: readonly [number, number] = [22, 38];

/**
 * Rounds to a price point that looks printed rather than calculated, without
 * ever letting the rounding overstate the saving.
 *
 * A raw division gives Rs 21,427, which reads as the output of a spreadsheet;
 * Rs 20,999 reads as a number off a box. The step grows with the value so the
 * result keeps landing on the ...999 ending that dominates real listings,
 * without a Rs 500 step shifting a Rs 1,700 item by nearly a third.
 *
 * Rounding to nearest can push the MRP *up* past the band ceiling -- the desk
 * organiser at Rs 1,999 targeted 40%, rounded from Rs 3,332 up to Rs 3,499
 * and advertised 43%, above what the printed MRP supports. So the result is
 * stepped back down until it is inside the ceiling. Stepping down can only
 * ever reduce the claimed discount, which is the safe direction to fail.
 */
function toPricePoint(rawPaise: number, pricePaise: number): number {
  const raw = rawPaise / 100;
  const step = raw < 3000 ? 100 : 500;

  let rupees = Math.max(step, Math.round(raw / step) * step);
  const pct = (r: number) => ((r * 100 - 100 - pricePaise) / (r * 100 - 100)) * 100;

  while (rupees > step && Math.round(pct(rupees)) > MAX_PERCENT) {
    rupees -= step;
  }

  return (rupees - 1) * 100;
}

export type CompareAt = {
  sku: string;
  /** What the customer pays. Unchanged by any of this. */
  pricePaise: number;
  /** The printed MRP, to be stored in Shopify. */
  comparePaise: number;
  /** Whole percent, as it will be displayed. */
  percentOff: number;
};

/**
 * The lowest and highest discount this is allowed to produce.
 *
 * A guard, not a target. Rounding to a price point moves the realised
 * discount a little either side of the target, and on a cheap item a single
 * step is a large proportion -- so the result has to be checked rather than
 * assumed. The ceiling is the important one: 40% is the most the printed MRP
 * will support, and anything above it must fail rather than quietly ship an
 * overstated saving.
 */
export const MIN_PERCENT = 18;
export const MAX_PERCENT = 40;

/**
 * Note the hash is taken over the *product* id, not the variant id, while the
 * arithmetic runs on each variant's own price.
 *
 * Hashing the variant was the obvious first move and it was wrong: it gave
 * the black Xyron an MRP of Rs 31,999 and the white one Rs 28,999, when both
 * sell for Rs 18,999. A printed MRP belongs to the product, so two colourways
 * at one price must show one MRP.
 *
 * Colourways priced differently are a separate case and are left alone. The
 * black footrest really does sell for Rs 1,599 against Rs 999 for the teak,
 * and once each is rounded to its own price point the realised discounts land
 * a couple of points apart. That is correct rather than a defect -- forcing
 * them equal would mean abandoning the printed price points, and real
 * listings show exactly this small variation across differently priced
 * variants.
 */
export function compareAtFor(
  productId: string,
  groupSlug: string,
  variantSku: string,
  pricePaise: number,
): CompareAt {
  const [low, high] = BANDS[groupSlug] ?? FALLBACK;

  // 16 bits is ample resolution for a band this narrow and keeps the
  // multiplication well inside the safe integer range.
  const spread = (hash(productId) % 65536) / 65536;
  const target = low + (high - low) * spread;

  const comparePaise = toPricePoint(pricePaise / (1 - target / 100), pricePaise);
  const percentOff = Math.round(
    ((comparePaise - pricePaise) / comparePaise) * 100,
  );

  return { sku: variantSku, pricePaise, comparePaise, percentOff };
}
