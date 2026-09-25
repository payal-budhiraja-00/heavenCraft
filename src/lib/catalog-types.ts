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
  /**
   * Set only where the supplier printed a separate feature sheet per finish
   * and the two disagree about the product itself rather than its colour.
   *
   * The Imperium executive table is the case this exists for: one finish
   * stands on solid wooden legs and the other on a powder-coated metal frame,
   * so a single merged list claimed both at once and half the page was wrong
   * whichever finish the reader had selected.
   *
   * Empty on every other product, where the finishes differ only in colour and
   * the product-level list is true of all of them.
   */
  features?: Feature[];
  /** Per-finish material claims. Present under the same condition as `features`. */
  materials?: string[];
};

/**
 * One row of the printed specification table, e.g. { label: "Width", value:
 * "44 cm" }. Values keep the supplier's own unit and wording.
 */
export type Specification = {
  label: string;
  value: string;
};

/**
 * A labelled selling point taken from the supplier's own feature sheet. Split
 * into heading and body because the heading is the scannable part -- a reader
 * deciding between two chairs wants to see "4D Adjustable Armrests" without
 * reading the sentence under it.
 */
export type Feature = {
  title: string;
  /** May be empty where the sheet printed a heading with no explanatory line. */
  detail: string;
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
  /**
   * Selling points as printed on the supplier's feature sheets. Replaced the
   * previous hand-written bullets wholesale after those were found to
   * contradict the sheets -- one desk was listed with a dual motor and memory
   * presets when the manufacturer's own artwork shows a hand crank.
   */
  features: Feature[];
  /**
   * Measured figures printed on the supplier's own dimension diagrams, copied
   * verbatim rather than converted, so a shopper checking whether a desk fits
   * an alcove is reading the manufacturer's number and not our arithmetic.
   * Units are therefore mixed across the range -- some sheets are in cm, some
   * in inches. Empty where the supplier published no diagram.
   */
  specifications: Specification[];
  /**
   * Printed material and finish claims, e.g. "Powder-coated steel". Separate
   * from `specifications` because they are qualities rather than measurements
   * and read better as prose than in a two-column table.
   */
  materials: string[];
  /**
   * Printed pack contents. Only a few products ship as a kit, so this is
   * usually empty -- but where it exists it answers the question a pegboard
   * buyer actually has, which is how many hooks and boxes come with it.
   */
  inTheBox: string[];
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
