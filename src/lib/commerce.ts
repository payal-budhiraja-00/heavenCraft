/**
 * The commerce seam, now wired.
 *
 * Everything above this -- catalog, routing, pages, metadata -- was built and
 * shipped before a Shopify account existed. This is the layer that turns a
 * catalog into a shop, and it is deliberately thin: Shopify owns the cart,
 * the totals and the checkout, and this file is only the translation between
 * Shopify's shapes and the site's.
 *
 * ## Where the variant IDs come from
 *
 * `cartLinesAdd` takes a `merchandiseId` -- a `ProductVariant` GID minted by
 * Shopify. It cannot be derived from products.json and cannot be guessed, so
 * it is read back out of the store by `scripts/shopify/variant-ids.ts` and
 * committed as a generated file. A product with no ID in that map is not
 * broken, it is simply not purchasable yet, and falls back to the enquiry
 * flow on its own.
 *
 * ## Why no totals are calculated here
 *
 * Every amount the cart renders comes from Shopify, never from local
 * arithmetic over products.json. Shopify is what the customer will actually
 * be charged, and it knows things this code does not: tax-inclusive pricing,
 * discount codes, market-specific prices. A cart quoting ₹13,999 against a
 * checkout asking ₹14,199 is an abandoned order, and the only way to
 * guarantee the two agree is to have one source.
 *
 * ## Auth
 *
 * None. See `shopify.ts` -- the Storefront API's tokenless mode covers the
 * whole cart surface, checkout is a redirect to Shopify's hosted page, and no
 * card data ever touches this origin.
 */

import { features } from "./features";
import type { Product } from "./catalog-types";
import { priceStringToPaise } from "./money";
import { storefront } from "./shopify";
import { SITE } from "./site";
import { GENERATED_VARIANTS } from "./variant-ids.generated";

/** Shopify `ProductVariant` GID. Minted by Shopify; cannot be derived. */
export type VariantId = string & { readonly __brand: "VariantId" };

export type CartLineInput = {
  variantId: VariantId;
  quantity: number;
};

/** A cart line as the UI needs it, flattened out of Shopify's nesting. */
export type CartLine = {
  /**
   * Shopify `CartLine` ID. Required to change or remove this line -- it is
   * not the variant ID, and the two are not interchangeable.
   */
  id: string;
  variantId: VariantId;
  quantity: number;
  title: string;
  imageUrl: string | null;
  imageAlt: string;
  /** Shopify's price for one unit. */
  unitPaise: number;
  /**
   * Shopify's price for the whole line. Deliberately not `unitPaise *
   * quantity`: line-level discounts make those two diverge, and the moment
   * they do, the arithmetic version is the wrong one.
   */
  linePaise: number;
  /** Product page on this site, when the SKU maps to a catalog product. */
  href: string | null;
};

export type Cart = {
  id: string;
  /**
   * Hosted Shopify checkout. The cart ID embedded in it acts as a bearer
   * credential for that cart, so this URL must never be logged, put in a
   * query string, or shared.
   */
  checkoutUrl: string;
  totalQuantity: number;
  /**
   * Shopify's own subtotal. Shipping is added at checkout, which is why the
   * UI says so rather than implying this is the final figure.
   */
  subtotalPaise: number;
  lines: CartLine[];
};

export interface CommerceAdapter {
  createCart(lines: CartLineInput[]): Promise<Cart>;
  addLines(cartId: string, lines: CartLineInput[]): Promise<Cart>;
  setLineQuantity(
    cartId: string,
    lineId: string,
    quantity: number,
  ): Promise<Cart>;
  removeLine(cartId: string, lineId: string): Promise<Cart>;
  getCart(cartId: string): Promise<Cart | null>;
}

/* -------------------------------------------------------------------------- */
/* Catalog mapping                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Variant IDs, keyed by the `id` in products.json.
 *
 * Read by `isPurchasable` to decide whether a product can be bought or only
 * enquired about, so the site degrades per-product rather than all at once.
 */
export const VARIANT_IDS: Readonly<Record<string, VariantId>> =
  Object.fromEntries(
    Object.entries(GENERATED_VARIANTS).map(([sku, variant]) => [
      sku,
      variant.variantId as VariantId,
    ]),
  );

/** Product page for a SKU, for linking cart lines back into the site. */
const HREF_BY_SKU: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(GENERATED_VARIANTS).map(([sku, variant]) => [sku, variant.href]),
);

export function variantIdFor(product: Product): VariantId | undefined {
  return VARIANT_IDS[product.id];
}

/**
 * Whether this product can be added to a cart at all. Requires both the build
 * flag and a real variant ID -- the flag alone is not enough.
 *
 * This is not the whole story at runtime: the preview gate in
 * `commerce-preview.ts` decides whether the cart is *visible* to a given
 * browser. Both must be true before an add-to-cart button renders.
 */
export function isPurchasable(product: Product): boolean {
  return features.commerce && variantIdFor(product) !== undefined;
}

/* -------------------------------------------------------------------------- */
/* Shopify cart                                                               */
/* -------------------------------------------------------------------------- */

const CART_FIELDS = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost { subtotalAmount { amount } }
    lines(first: 100) {
      nodes {
        id
        quantity
        cost { totalAmount { amount } }
        merchandise {
          ... on ProductVariant {
            id
            sku
            price { amount }
            image { url altText }
            product { title }
          }
        }
      }
    }
  }
`;

type RawCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: { amount: string } };
  lines: {
    nodes: {
      id: string;
      quantity: number;
      cost: { totalAmount: { amount: string } };
      merchandise: {
        id: string;
        sku: string | null;
        price: { amount: string };
        image: { url: string; altText: string | null } | null;
        product: { title: string };
      };
    }[];
  };
};

type UserError = { field: string[] | null; message: string };

function toCart(raw: RawCart): Cart {
  return {
    id: raw.id,
    checkoutUrl: raw.checkoutUrl,
    totalQuantity: raw.totalQuantity,
    subtotalPaise: priceStringToPaise(raw.cost.subtotalAmount.amount),
    lines: raw.lines.nodes.map((line) => {
      const variant = line.merchandise;
      const title = variant.product.title;

      return {
        id: line.id,
        variantId: variant.id as VariantId,
        quantity: line.quantity,
        title,
        imageUrl: variant.image?.url ?? null,
        /*
         * The sync wrote real alt text into Shopify, so this fallback should
         * never fire. It exists for a product added by hand in the admin,
         * where an empty alt on the only thing distinguishing two similar
         * chairs in a list would be a silent accessibility hole.
         */
        imageAlt: variant.image?.altText ?? title,
        unitPaise: priceStringToPaise(variant.price.amount),
        linePaise: priceStringToPaise(line.cost.totalAmount.amount),
        href: variant.sku ? (HREF_BY_SKU[variant.sku] ?? null) : null,
      };
    }),
  };
}

/**
 * Shopify reports business-rule failures -- sold out, quantity above the
 * limit, cart expired -- in a `userErrors` array alongside a perfectly
 * successful HTTP 200 and no GraphQL `errors`. Skipping this check is how a
 * "successful" add-to-cart silently adds nothing.
 */
function assertNoUserErrors(
  errors: UserError[] | undefined,
  action: string,
): void {
  if (!errors?.length) return;
  throw new Error(`${action}: ${errors.map((e) => e.message).join("; ")}`);
}

const CREATE = `
  ${CART_FIELDS}
  mutation CartCreate($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

const ADD = `
  ${CART_FIELDS}
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

const UPDATE = `
  ${CART_FIELDS}
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

const REMOVE = `
  ${CART_FIELDS}
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

const GET = `
  ${CART_FIELDS}
  query GetCart($cartId: ID!) {
    cart(id: $cartId) { ...CartFields }
  }
`;

function toLineInput(lines: CartLineInput[]) {
  return lines.map((line) => ({
    merchandiseId: line.variantId,
    quantity: line.quantity,
  }));
}

export const shopifyCommerce: CommerceAdapter = {
  async createCart(lines) {
    const data = await storefront<{
      cartCreate: { cart: RawCart | null; userErrors: UserError[] };
    }>(CREATE, { lines: toLineInput(lines) });

    assertNoUserErrors(data.cartCreate.userErrors, "Could not start a cart");
    if (!data.cartCreate.cart) throw new Error("Could not start a cart");

    return toCart(data.cartCreate.cart);
  },

  async addLines(cartId, lines) {
    const data = await storefront<{
      cartLinesAdd: { cart: RawCart | null; userErrors: UserError[] };
    }>(ADD, { cartId, lines: toLineInput(lines) });

    assertNoUserErrors(data.cartLinesAdd.userErrors, "Could not add to cart");
    if (!data.cartLinesAdd.cart) throw new Error("Could not add to cart");

    return toCart(data.cartLinesAdd.cart);
  },

  async setLineQuantity(cartId, lineId, quantity) {
    const data = await storefront<{
      cartLinesUpdate: { cart: RawCart | null; userErrors: UserError[] };
    }>(UPDATE, { cartId, lines: [{ id: lineId, quantity }] });

    assertNoUserErrors(
      data.cartLinesUpdate.userErrors,
      "Could not update the cart",
    );
    if (!data.cartLinesUpdate.cart) throw new Error("Could not update the cart");

    return toCart(data.cartLinesUpdate.cart);
  },

  async removeLine(cartId, lineId) {
    const data = await storefront<{
      cartLinesRemove: { cart: RawCart | null; userErrors: UserError[] };
    }>(REMOVE, { cartId, lineIds: [lineId] });

    assertNoUserErrors(
      data.cartLinesRemove.userErrors,
      "Could not update the cart",
    );
    if (!data.cartLinesRemove.cart) throw new Error("Could not update the cart");

    return toCart(data.cartLinesRemove.cart);
  },

  async getCart(cartId) {
    const data = await storefront<{ cart: RawCart | null }>(GET, { cartId });

    /*
     * Null rather than an error. Shopify expires carts after roughly ten days
     * of inactivity, so a returning visitor holding a stale ID is an ordinary
     * event the caller should handle by starting a new cart, not a failure to
     * surface to them.
     */
    return data.cart ? toCart(data.cart) : null;
  },
};

/* -------------------------------------------------------------------------- */
/* Enquiry fallback                                                           */
/* -------------------------------------------------------------------------- */

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
