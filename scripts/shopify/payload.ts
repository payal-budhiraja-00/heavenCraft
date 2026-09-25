/**
 * Turns the local catalog into the shape Shopify wants.
 *
 * Shared by the CSV export and the Admin API sync so the two can never
 * disagree about what a product is. Anything that decides *what* gets sent
 * belongs here; the two callers only decide *how* it is transmitted.
 */

import { allProducts } from "../../src/lib/catalog";
import type { Product, Variant } from "../../src/lib/catalog-types";
import { encodeImagePath, imageAlt } from "../../src/lib/images";
import { paiseToPriceString } from "../../src/lib/money";
import { SITE, absoluteUrl } from "../../src/lib/site";
import { RENAMED } from "../legacy-redirects";

export type ShopifyImage = {
  src: string;
  altText: string;
  position: number;
};

/**
 * One colourway.
 *
 * `sku` is `<product id>--<colour slug>` and is the join between this catalog
 * and the storefront cart: `variant-ids.generated.ts` maps it to the Shopify
 * variant GID the Cart API needs. It keys off the product id rather than the
 * name because a name can change -- seven did in September 2026 -- and a SKU
 * that moves is a SKU that no longer matches the orders already placed
 * against it.
 */
export type ShopifyVariant = {
  sku: string;
  colour: string;
  price: string;
  /** This colourway's own photographs, in gallery order. */
  images: ShopifyImage[];
};

export type ShopifyProduct = {
  handle: string;
  title: string;
  bodyHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  variants: ShopifyVariant[];
  /** Every colourway's photographs, flattened, in the order they are shown. */
  images: ShopifyImage[];
  /** Where this product lives on the marketing site. */
  sourceHref: string;
  /**
   * A handle this product was previously published under, if it was renamed.
   * The sync uses it to find and rename the existing Shopify product rather
   * than creating a second one alongside it.
   */
  previousHandle?: string;
};

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Shopify renders this as the product description, and it is the only place
 * the specifications reach the buyer on that side: the Storefront API exposes
 * no field for them, and metafields would need a matching theme change to
 * surface. Putting them in the body means they show in the online store, in
 * admin, and in any channel that reads the description.
 *
 * Features become a list rather than a paragraph because that is how they read
 * on our own product pages, and a buyer comparing two chairs scans a list.
 */
function bodyHtml(product: Product): string {
  const parts = [`<p>${escapeHtml(product.description)}</p>`];

  const featureList = (features: Product["features"]): string =>
    features
      .map((feature) =>
        feature.detail
          ? `<li><strong>${escapeHtml(feature.title)}</strong> — ${escapeHtml(feature.detail)}</li>`
          : `<li><strong>${escapeHtml(feature.title)}</strong></li>`,
      )
      .join("");

  const perFinish = product.variants.filter(
    (v) => v.features?.length || v.materials?.length,
  );

  /*
    Where the finishes have their own printed sheets, each section below is
    already complete on its own. Emitting the product-level list as well would
    lead with the two or three lines the sheets happen to share and then repeat
    them inside every section, which reads like a mistake.
  */
  if (!perFinish.length && product.features.length) {
    parts.push(`<h3>Features</h3><ul>${featureList(product.features)}</ul>`);
  }

  /*
    Shopify has one description per product and no way to vary it per variant,
    so where the finishes differ in more than colour the only honest form is a
    heading each. The footrest is the sharp case: its black model is adjustable
    and has massage rollers, and its wooden and marble models are fixed
    platforms with no moving parts.
  */
  for (const variant of perFinish) {
    const section = [`<h3>${escapeHtml(variant.colour)} finish</h3>`];
    if (variant.features?.length) {
      section.push(`<ul>${featureList(variant.features)}</ul>`);
    }
    if (variant.materials?.length) {
      section.push(
        `<p><strong>Materials &amp; finish:</strong> ${escapeHtml(variant.materials.join(" · "))}</p>`,
      );
    }
    parts.push(section.join(""));
  }

  if (product.specifications.length || product.materials.length) {
    const rows = product.specifications
      .map(
        (spec) =>
          `<tr><td>${escapeHtml(spec.label)}</td><td>${escapeHtml(spec.value)}</td></tr>`,
      )
      .join("");
    const materials = product.materials.length
      ? `<tr><td>Materials &amp; finish</td><td>${escapeHtml(product.materials.join(" · "))}</td></tr>`
      : "";
    parts.push(`<h3>Specifications</h3><table>${rows}${materials}</table>`);
  }

  if (product.inTheBox.length) {
    const items = product.inTheBox
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
    parts.push(`<h3>In the box</h3><ul>${items}</ul>`);
  }

  return parts.join("");
}

/**
 * Matches the truncation on the live product page exactly, so the same product
 * does not carry two different descriptions across two surfaces Google indexes.
 */
function seoDescription(product: Product): string {
  return product.description.length > 155
    ? `${product.description.slice(0, 152).trimEnd()}…`
    : product.description;
}

/**
 * Gallery order now simply follows the catalog.
 *
 * This used to sort images carrying a rival's wordmark to the back so they
 * would not become position 1 -- the collection thumbnail, the checkout
 * line-item image and the social card. That rule is now keyed by product
 * rather than by file, because the offending mark is moulded into the desk
 * leg and therefore appears in every frame. So for the two products affected
 * there is no safe frame to promote, and for every other product there is
 * nothing to demote. Reordering here would only shuffle the gallery away from
 * the order the buyer sees on our own product page.
 */
function variantImages(product: Product, variant: Variant, from: number): ShopifyImage[] {
  const named = product.variants.length > 1 ? variant.colour : undefined;

  return variant.images.map((src, index) => ({
    // Shopify fetches these over the public internet and re-hosts them, so
    // they must be absolute and the spaces in the filenames must be encoded.
    src: absoluteUrl(encodeImagePath(src)),
    altText: imageAlt(product, index, named),
    position: from + index + 1,
  }));
}

/**
 * The site groups products in the plural ("Storage Boxes") while Shopify's
 * convention for product type is singular. Just dropping a trailing "s" gives
 * "Storage Boxe", so handle the -es and -ies endings as well.
 */
function singular(label: string): string {
  if (/(ch|sh|s|x|z)es$/i.test(label)) return label.slice(0, -2);
  if (/[^aeiou]ies$/i.test(label)) return `${label.slice(0, -3)}y`;
  if (/ss$/i.test(label)) return label;
  return label.replace(/s$/i, "");
}

export function toShopifyProduct(product: Product): ShopifyProduct {
  const images: ShopifyImage[] = [];
  const variants = product.variants.map((variant) => {
    const own = variantImages(product, variant, images.length);
    images.push(...own);
    return {
      sku: variant.id,
      colour: variant.colour,
      price: paiseToPriceString(variant.pricePaise),
      images: own,
    };
  });

  const renamed = RENAMED.find((r) => r.to === product.slug);

  return {
    handle: product.slug,
    title: product.name,
    bodyHtml: bodyHtml(product),
    vendor: SITE.name,
    productType: singular(product.subName),
    tags: [product.groupName, product.subName, "Ergonomic", SITE.city],
    seoTitle: product.name,
    seoDescription: seoDescription(product),
    variants,
    images,
    sourceHref: product.href,
    ...(renamed ? { previousHandle: renamed.from } : {}),
  };
}

/**
 * Shopify handles are unique across the whole store, while our slugs are only
 * guaranteed unique within a group -- `assertNoRouteCollisions` in catalog.ts
 * deliberately allows /chairs/x and /tables/x to coexist. Two products sharing
 * a handle would silently merge on import, so this is checked before anything
 * is written or sent.
 */
export function buildCatalog(): ShopifyProduct[] {
  const products = allProducts.map(toShopifyProduct);

  const byHandle = new Map<string, string>();
  const collisions: string[] = [];
  for (const product of products) {
    const clash = byHandle.get(product.handle);
    if (clash) collisions.push(`${product.handle}: ${clash} and ${product.title}`);
    byHandle.set(product.handle, product.title);
  }

  if (collisions.length) {
    throw new Error(
      `Shopify handles must be unique store-wide, but these collide:\n  ${collisions.join("\n  ")}`,
    );
  }

  /* A SKU is what an order line records, so a duplicate does not merge two
   * products loudly the way a handle collision does -- it quietly makes the
   * picking list ambiguous once the order is already placed. */
  const bySku = new Map<string, string>();
  const skuClashes: string[] = [];
  for (const product of products) {
    for (const variant of product.variants) {
      const clash = bySku.get(variant.sku);
      if (clash) skuClashes.push(`${variant.sku}: ${clash} and ${product.handle}`);
      bySku.set(variant.sku, product.handle);
    }
  }

  if (skuClashes.length) {
    throw new Error(
      `SKUs must be unique store-wide, but these collide:\n  ${skuClashes.join("\n  ")}`,
    );
  }

  return products;
}

/** Every distinct image URL the import will ask Shopify to fetch. */
export function allImageUrls(products: ShopifyProduct[]): string[] {
  return [...new Set(products.flatMap((p) => p.images.map((i) => i.src)))];
}
