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

export type Product = {
  id: string;
  /** URL slug, unique within its group. Derived from the trimmed name. */
  slug: string;
  /** Trimmed. Seven names in the source data carry a leading space. */
  name: string;
  description: string;
  /** Manufacturer-declared specifications. Not measured by HeavenCraft. */
  features: string[];
  groupSlug: GroupSlug;
  groupName: string;
  subSlug: string;
  subName: string;
  pricePaise: number;
  inStock: boolean;
  /** Raw paths as they sit on disk; several contain spaces. Encode at render. */
  images: string[];
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
