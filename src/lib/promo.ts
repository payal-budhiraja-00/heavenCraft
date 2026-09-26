import { allProducts } from "./catalog";
import { offerForSku } from "./commerce";
import { TERMS } from "./site";

/**
 * The promotional strip's contents, worked out from the catalogue at build
 * time.
 *
 * ## Why this is computed and not written down
 *
 * "Up to 36% off" is a claim about prices, and prices move. A hand-written
 * number stays at 36 after a repricing takes the real maximum to 31, and the
 * site then advertises a discount no product offers. Deriving it from the
 * same `offerForSku` the price tags use means the strip cannot outlive the
 * thing it describes.
 *
 * Runs on the server only. The banner itself is a client component, so the
 * finished strings are handed to it as props rather than letting the whole
 * catalogue follow `allProducts` into the browser bundle.
 */

/** The largest honest discount anywhere in the catalogue, or 0 if none. */
export function maxPercentOff(): number {
  let max = 0;

  for (const product of allProducts) {
    for (const variant of product.variants) {
      const offer = offerForSku(variant.id, variant.pricePaise);
      if (offer && offer.percentOff > max) max = offer.percentOff;
    }
  }

  return max;
}

/**
 * The rotating messages.
 *
 * Every line is a fact already stated elsewhere on the site -- the discount
 * comes from the price tags, the rest from `TERMS`, which is what the product
 * pages and the policies read from. Nothing here is a claim the site cannot
 * otherwise back up.
 */
export function promoMessages(): string[] {
  const messages: string[] = [];
  const percent = maxPercentOff();

  /* "Up to" is doing real work: only a handful of products reach the maximum,
   * and stating it as a flat discount would be false for most of the range. */
  if (percent > 0) messages.push(`Up to ${percent}% off everything`);

  if (TERMS.codAvailable) {
    messages.push(
      TERMS.codFee === 0
        ? "Cash on delivery, no extra charge"
        : "Cash on delivery available",
    );
  }

  messages.push(
    `${TERMS.returnDays}-day returns, return shipping on us`,
  );

  return messages;
}
