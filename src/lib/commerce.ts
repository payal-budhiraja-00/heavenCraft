/**
 * The commerce seam.
 *
 * This is where Shopify plugs in, and it is deliberately the last thing built.
 * Everything above it -- catalog, routing, pages, metadata -- is finished and
 * shippable without a Shopify account existing.
 *
 * ## Why this file is a stub
 *
 * Shopify's Cart API is variant-bound: `cartLinesAdd` takes a
 * `merchandiseId`, which is a `ProductVariant` GID like
 * `gid://shopify/ProductVariant/43729076512`. That ID is minted by Shopify
 * when the product is created in the store. It cannot be derived from
 * anything in products.json, it cannot be guessed, and there is no useful
 * placeholder for it -- a cart line with a fabricated merchandise ID is a
 * failed mutation, not a degraded one.
 *
 * So the hard dependency is not "a Shopify API key". It is 34 products
 * existing in a Shopify store, each with at least one variant, and each
 * variant ID recorded against the `id` in products.json. Until that mapping
 * exists there is nothing for an add-to-cart button to add.
 *
 * ## What happens when it does exist
 *
 * `variantId` gets populated from the mapping, `features.commerce` flips to
 * true, and `createCart` / `addLines` are implemented against the Storefront
 * API. No page component changes: they already ask `commerce` what to render.
 *
 * ## Auth, for the record
 *
 * None of this needs a server. The Storefront API's tokenless access covers
 * products, collections, search and -- crucially -- the whole Cart surface,
 * with a per-buyer-IP rate limit standing in for authentication. Checkout is
 * a redirect to Shopify's own hosted page, so no card data ever touches this
 * origin.
 */

import { features } from "./features";
import type { Product } from "./catalog-types";
import { SITE } from "./site";

/** Shopify `ProductVariant` GID. Minted by Shopify; cannot be derived. */
export type VariantId = string & { readonly __brand: "VariantId" };

export type CartLine = {
  variantId: VariantId;
  quantity: number;
};

export type Cart = {
  id: string;
  /**
   * Shopify's own total. Always rendered from here rather than from local
   * arithmetic: `CartCost` is documented as an estimate that shipping, taxes
   * and discounts may change, and a cart that disagrees with checkout is a
   * lost order.
   */
  totalPaise: number;
  lines: (CartLine & { titleSnapshot: string })[];
  /**
   * Hosted Shopify checkout. The cart ID embedded in it carries a secret, so
   * this URL must never be logged, shared or put in a query string.
   */
  checkoutUrl: string;
};

export interface CommerceAdapter {
  createCart(lines: CartLine[]): Promise<Cart>;
  addLines(cartId: string, lines: CartLine[]): Promise<Cart>;
  getCart(cartId: string): Promise<Cart | null>;
}

/**
 * Variant IDs, keyed by the `id` in products.json.
 *
 * Populated once the Shopify store is stocked. Empty until then, which is what
 * `isPurchasable` reads to decide whether a product can be bought or only
 * enquired about -- so the site degrades per-product rather than all at once,
 * and the first few products can go live before all 34 are loaded.
 */
export const VARIANT_IDS: Readonly<Record<string, VariantId>> = {};

export function variantIdFor(product: Product): VariantId | undefined {
  return VARIANT_IDS[product.id];
}

/**
 * Whether this specific product can be added to a cart right now. Requires
 * both the feature flag and a real variant ID -- the flag alone is not enough.
 */
export function isPurchasable(product: Product): boolean {
  return features.commerce && variantIdFor(product) !== undefined;
}

/** Anything can be enquired about, including things not yet in Shopify. */
export function enquiryHref(product: Product, origin: string): string {
  const subject = `Enquiry: ${product.name}`;
  const body = [
    `I would like to enquire about this product.`,
    ``,
    `Product: ${product.name}`,
    `Reference: ${product.id}`,
    `Page: ${origin}${product.href}`,
    ``,
    `Quantity needed:`,
    `Delivery pincode:`,
    `Name:`,
    `Phone:`,
    ``,
  ].join("\n");

  return `mailto:${SITE.email}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}
