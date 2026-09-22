/**
 * Turns the local catalog into the shape Shopify wants.
 *
 * Shared by the CSV export and the Admin API sync so the two can never
 * disagree about what a product is. Anything that decides *what* gets sent
 * belongs here; the two callers only decide *how* it is transmitted.
 */

import { allProducts } from "../../src/lib/catalog";
import type { Product } from "../../src/lib/catalog-types";
import { encodeImagePath, imageAlt, isFeatureSafe } from "../../src/lib/images";
import { paiseToPriceString } from "../../src/lib/money";
import { SITE, absoluteUrl } from "../../src/lib/site";

export type ShopifyImage = {
  src: string;
  altText: string;
  position: number;
};

export type ShopifyProduct = {
  handle: string;
  title: string;
  bodyHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  sku: string;
  price: string;
  seoTitle: string;
  seoDescription: string;
  images: ShopifyImage[];
  /** Where this product lives on the marketing site. */
  sourceHref: string;
};

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Shopify renders this as the product description. Features become a list
 * rather than a paragraph because that is how they read on our own product
 * pages, and a buyer comparing two chairs scans a list.
 */
function bodyHtml(product: Product): string {
  const description = `<p>${escapeHtml(product.description)}</p>`;
  if (product.features.length === 0) return description;

  const items = product.features
    .map((feature) => `<li>${escapeHtml(feature)}</li>`)
    .join("");
  return `${description}<ul>${items}</ul>`;
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
 * Position 1 is the product's face: it is the collection thumbnail, the
 * checkout line-item image and the social card. The two supplier photographs
 * carrying a rival's wordmark are therefore pushed down the gallery rather
 * than dropped -- they are honest photographs of the product, just not ones
 * to lead with.
 */
function orderedImages(product: Product): ShopifyImage[] {
  const safe = product.images.filter(isFeatureSafe);
  const rest = product.images.filter((src) => !isFeatureSafe(src));

  return [...safe, ...rest].map((src, index) => ({
    // Shopify fetches these over the public internet and re-hosts them, so
    // they must be absolute and the spaces in the filenames must be encoded.
    src: absoluteUrl(encodeImagePath(src)),
    altText: imageAlt(product, product.images.indexOf(src)),
    position: index + 1,
  }));
}

export function toShopifyProduct(product: Product): ShopifyProduct {
  return {
    handle: product.slug,
    title: product.name,
    bodyHtml: bodyHtml(product),
    vendor: SITE.name,
    productType: product.subName.replace(/s$/, ""),
    tags: [product.groupName, product.subName, "Ergonomic", SITE.city],
    sku: product.id,
    price: paiseToPriceString(product.pricePaise),
    seoTitle: product.name,
    seoDescription: seoDescription(product),
    images: orderedImages(product),
    sourceHref: product.href,
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
    if (clash) collisions.push(`${product.handle}: ${clash} and ${product.sku}`);
    byHandle.set(product.handle, product.sku);
  }

  if (collisions.length) {
    throw new Error(
      `Shopify handles must be unique store-wide, but these collide:\n  ${collisions.join("\n  ")}`,
    );
  }

  return products;
}

/** Every distinct image URL the import will ask Shopify to fetch. */
export function allImageUrls(products: ShopifyProduct[]): string[] {
  return [...new Set(products.flatMap((p) => p.images.map((i) => i.src)))];
}
