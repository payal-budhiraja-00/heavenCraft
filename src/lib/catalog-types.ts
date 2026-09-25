/**
 * Catalog shapes.
 *
 * Kept free of any import that touches the filesystem so client components can
 * share these types without dragging build-time code into the browser bundle.
 */

export type Review = {
  id: number;
  author: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  /**
   * Whether the source data claimed this was a verified purchase. Deliberately
   * NOT rendered as a badge unless `features.reviewsAreReal` is set -- the flag
   * in the data is seeded demo content, not a checked fact.
   */
  claimedVerified: boolean;
};

export type Variant = {
  /** Stable id, unique within the product: "<product-slug>--<colour-slug>". */
  id: string;
  /** Colour exactly as the supplier wrote it, e.g. "Black-Dark Grey". */
  colour: string;
  /** URL- and DOM-safe form of `colour`. */
  colourSlug: string;
  pricePaise: number;
  /** Raw paths as they sit on disk. Encode at render. */
  images: string[];
  inStock: boolean;
};

export type Product = {
  id: string;
  /** URL slug, unique within its group. Derived from the trimmed name. */
  slug: string;
  /** Trimmed. Seven names in the source data carry a leading space. */
  name: string;
  /**
   * The supplier's bare model name, e.g. "Neuro" where `name` is "Neuro Mesh
   * Chair". Used as the page heading, where the category is already on screen
   * a line above. `name` is kept for the title tag, search results and basket
   * lines, all of which are read without that surrounding context.
   */
  shortName: string;
  description: string;
  /** Manufacturer-declared specifications. Not measured by HeavenCraft. */
  features: string[];
  groupSlug: GroupSlug;
  groupName: string;
  subSlug: string;
  subName: string;
  /**
   * The lowest price across variants. Every colourway is the same price today
   * except the footrests, so a card can show one figure honestly -- but it is
   * a minimum, not a fact about any particular variant.
   */
  pricePaise: number;
  inStock: boolean;
  /** The default variant's gallery, so cards and social cards need no lookup. */
  images: string[];
  /**
   * Always at least one entry. A product with a single colourway still has a
   * variant, because the basket is variant-bound: Shopify's Cart API takes a
   * ProductVariant id and has no concept of adding "a product".
   */
  variants: Variant[];
  reviews: Review[];
  /** Canonical path, e.g. /chairs/neuro-mesh-chair */
  href: string;
};

export type SubCategory = {
  slug: string;
  name: string;
  description: string;
  groupSlug: GroupSlug;
  products: Product[];
  href: string;
  /**
   * True when this range holds exactly one product whose slug is identical to
   * the range's own -- "Peg-Board" inside "Peg-Boards". Both would claim
   * /accessories/peg-board, so the product wins the URL and no range page is
   * emitted: a listing page showing a single card of the same name is a
   * duplicate of the page it links to, and costs the visitor a second click.
   *
   * `href` is unchanged, because it is already the same string. Navigation
   * keeps linking to the range and simply lands on the product.
   */
  collapsed: boolean;
};

export type GroupSlug = "chairs" | "tables" | "accessories";

export type Group = {
  slug: GroupSlug;
  name: string;
  description: string;
  subCategories: SubCategory[];
  products: Product[];
  href: string;
};

export type PriceRange = {
  minPaise: number;
  maxPaise: number;
  count: number;
};

export function priceRange(products: Product[]): PriceRange {
  const prices = products.map((p) => p.pricePaise).sort((a, b) => a - b);
  return {
    minPaise: prices[0] ?? 0,
    maxPaise: prices[prices.length - 1] ?? 0,
    count: prices.length,
  };
}
