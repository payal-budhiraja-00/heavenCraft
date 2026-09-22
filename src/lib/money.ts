/**
 * Money helpers.
 *
 * Every amount in this codebase is an integer number of paise (₹1 = 100 paise).
 * Rupee floats are only ever produced at the edges: display, and third-party
 * APIs that insist on them. Shopify's Storefront API quotes decimal strings, so
 * anything arriving from it is parsed here and never carried around as a float.
 */

export const PAISE_PER_RUPEE = 100;

/**
 * Order value above which we absorb delivery. Carried over from the legacy
 * site and not yet tested against real freight rates -- an assembled chair can
 * bill at roughly 68 kg volumetric, so this number needs revisiting before it
 * is re-promised in marketing.
 */
export const FREE_SHIPPING_THRESHOLD_PAISE = 2_000_000;

/** ₹1,299.50 -> 129950. Throws on non-finite input. */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) {
    throw new TypeError(`Cannot convert non-finite value to paise: ${rupees}`);
  }

  return Math.round(rupees * PAISE_PER_RUPEE);
}

/** 129950 -> 1299.5. Only for display or APIs that require rupee floats. */
export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

/**
 * "13999.00" -> 1399900.
 *
 * Shopify quotes every amount as a decimal string. This is the single place
 * those strings become integers, so a float never escapes into cart
 * arithmetic -- `0.1 + 0.2` problems are invisible at ₹13,999 and appear as a
 * one-paise mismatch between the cart total and the checkout total, which is
 * precisely the kind of discrepancy that loses an order.
 */
export function priceStringToPaise(amount: string): number {
  const rupees = Number(amount);

  if (!Number.isFinite(rupees)) {
    throw new TypeError(`Not a money amount: ${amount}`);
  }

  return Math.round(rupees * PAISE_PER_RUPEE);
}

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const INR_FORMATTER_WITH_PAISE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * 1399900 -> "₹13,99,900" (Indian lakh/crore grouping).
 * Paise are hidden when the amount is a whole number of rupees, which is the
 * case for essentially every furniture price.
 */
export function formatPaise(paise: number): string {
  const rupees = paiseToRupees(paise);
  const formatter =
    paise % PAISE_PER_RUPEE === 0 ? INR_FORMATTER : INR_FORMATTER_WITH_PAISE;

  return formatter.format(rupees);
}

/** The bare number for structured data, which wants "13999.00" not "₹13,999". */
export function paiseToPriceString(paise: number): string {
  return (paise / PAISE_PER_RUPEE).toFixed(2);
}
