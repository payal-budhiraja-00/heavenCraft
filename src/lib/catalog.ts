/**
 * The catalog, normalised once at build time.
 *
 * products.json is the source of truth for editorial content and carries a
 * handful of defects inherited from hand-editing: seven names begin with a
 * space, one sub-category is mixed-case, and image filenames contain spaces.
 * All of that is cleaned here rather than in the pages, so a page never has to
 * know the data was ever untidy.
 *
 * Everything below runs during `next build`. Nothing in this module reaches the
 * browser except the plain objects it returns.
 */

import raw from "@/data/products.json";
import type {
  Feature,
  Group,
  GroupSlug,
  Product,
  Review,
  Specification,
  SubCategory,
  Variant,
} from "./catalog-types";
import { rupeesToPaise } from "./money";

type RawReview = {
  id: number;
  author: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  verified?: boolean;
};

type RawVariant = {
  id: string;
  colour: string;
  colourSlug: string;
  price: number;
  images: string[];
  inStock?: boolean;
  features?: { title: string; detail?: string }[];
  specifications?: { label: string; value: string }[];
  materials?: string[];
};

type RawProduct = {
  id: string;
  name: string;
  shortName?: string;
  category: string;
  subCategory: string;
  subName?: string;
  price: number;
  currency: string;
  rating?: number;
  description: string;
  features?: { title: string; detail?: string }[];
  specifications?: { label: string; value: string }[];
  materials?: string[];
  inTheBox?: string[];
  images?: string[];
  inStock?: boolean;
  variants?: RawVariant[];
  reviews?: RawReview[];
};

/** `category` in the data is singular; the URL and the page title are not. */
const GROUP_OF: Record<string, GroupSlug> = {
  chair: "chairs",
  table: "tables",
  accessories: "accessories",
};

const GROUP_META: Record<GroupSlug, { name: string; description: string }> = {
  chairs: {
    name: "Chairs",
    description:
      "Mesh and performance-mesh task chairs built to be sat in for twelve hours, not looked at for five minutes.",
  },
  tables: {
    name: "Tables",
    description:
      "Height-adjustable, executive, study and folding desks for workspaces that have to earn their footprint.",
  },
  accessories: {
    name: "Accessories",
    description:
      "Footrests, trays, organisers and the small hardware that decides whether a desk actually works.",
  },
};

/**
 * Display names for sub-categories. A naive title-case would give "Peg Boards"
 * and "Desk Side Organisers" from the slug alone, so every range is named
 * explicitly and the derived plural is only a fallback.
 *
 * Several slugs deliberately no longer match their display name: the September
 * 2026 range change renamed "Cable Trays" to "Cable Management Tray", but the
 * slug stays `cable-tray` because that URL is indexed. A slug is an address,
 * not a label, and renaming one costs ranking for no gain.
 */
const SUB_META: Record<string, { name: string; description: string }> = {
  "mesh-chair": {
    name: "Mesh Chairs",
    description:
      "Breathable mesh backs that stay cool through a full working day.",
  },
  "performance-mesh-chair": {
    name: "Performance Mesh Chairs",
    description:
      "Mesh chairs with a deeper range of adjustment, for desks that are worked at rather than sat at.",
  },
  "bed-table": {
    name: "Bed Tables",
    description: "Portable laptop tables for working from a bed or a couch.",
  },
  "folding-table": {
    name: "Folding Tables",
    description: "Tables that fold flat when the room has to do something else.",
  },
  "height-adjustable-table": {
    name: "Height-Adjustable Tables",
    description:
      "Sit-stand desks that move between seated and standing height through the day.",
  },
  "executive-table": {
    name: "Executive Tables",
    description: "Larger desks for cabins, directors' offices and meeting use.",
  },
  "study-table": {
    name: "Study Tables",
    description: "Compact desks sized for students and home study corners.",
  },
  "gaming-desk": {
    name: "Gaming Desks",
    description: "Deep-surface desks built around multi-monitor setups.",
  },
  footrest: {
    name: "Footrests",
    description:
      "Angled footrests that fix hip angle when the chair is at the right height but the floor is not.",
  },
  "cable-tray": {
    name: "Cable Management Trays",
    description: "Under-desk cable management for a desk that can still move.",
  },
  "cup-holder": {
    name: "Cup Holders",
    description: "Clamp-on holders that keep a drink off the work surface.",
  },
  "desk-shelf-tray": {
    name: "Desk Shelf Trays",
    description: "Raised shelves that give back the desk space under a monitor.",
  },
  "desk-side-organiser": {
    name: "Desk Side Organisers",
    description:
      "Side-mounted storage for the things that otherwise live on the work surface.",
  },
  "keyboard-tray": {
    name: "Keyboard Trays",
    description:
      "Under-desk trays that drop the keyboard to elbow height without lowering the whole desk.",
  },
  "peg-board": {
    name: "Peg-Boards",
    description:
      "Perforated boards that clamp to the back of the desk and take hooks, cups and holders.",
  },
};

/** "Neuro Mesh Chair" -> "neuro-mesh-chair" */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Image paths on disk contain spaces; the browser needs them encoded. */
export function encodeImagePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function titleCasePlural(slug: string): string {
  const words = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return words.endsWith("s") ? words : `${words}s`;
}

function toReview(r: RawReview): Review {
  return {
    id: r.id,
    author: r.author,
    rating: r.rating,
    date: r.date,
    title: r.title,
    comment: r.comment,
    claimedVerified: r.verified === true,
  };
}

function toFeatures(raw: { title: string; detail?: string }[]): Feature[] {
  return raw
    .map((f) => ({ title: f.title.trim(), detail: (f.detail ?? "").trim() }))
    .filter((f) => f.title !== "");
}

function toLines(raw: string[]): string[] {
  return raw.map((s) => s.trim()).filter(Boolean);
}

function toSpecs(raw: { label: string; value: string }[]): Specification[] {
  return raw
    .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
    .filter((s) => s.label !== "" && s.value !== "");
}

function build(): { groups: Group[]; products: Product[] } {
  const rows = raw as RawProduct[];
  const products: Product[] = [];

  for (const row of rows) {
    const groupSlug = GROUP_OF[row.category];
    if (!groupSlug) {
      throw new Error(
        `Product ${row.id} has unknown category "${row.category}". ` +
          `Expected one of: ${Object.keys(GROUP_OF).join(", ")}.`,
      );
    }

    // "Cpu-Stand" and "cable-tray" both appear in the source data. Case is
    // normalised here because the host filesystem is case-sensitive and a
    // mixed-case URL is a live 404 waiting to happen.
    const subSlug = slugify(row.subCategory);
    const name = row.name.trim();
    const slug = slugify(name);
    const sub = SUB_META[subSlug];

    // Single-colourway products still get a variant. The basket is
    // variant-bound -- Shopify's Cart API takes a ProductVariant id and cannot
    // express "add the product" -- so a product with no variants would be
    // unbuyable. Synthesising one here keeps every downstream consumer,
    // including the colour picker and the BuyBox, on a single code path.
    const rawVariants: RawVariant[] =
      row.variants && row.variants.length > 0
        ? row.variants
        : [
            {
              id: `${slug}--default`,
              colour: "Default",
              colourSlug: "default",
              price: row.price,
              images: row.images ?? [],
              inStock: row.inStock,
            },
          ];

    const variants: Variant[] = rawVariants.map((v) => {
      const features = toFeatures(v.features ?? []);
      const materials = toLines(v.materials ?? []);
      const specifications = toSpecs(v.specifications ?? []);

      return {
        id: v.id,
        colour: v.colour.trim(),
        colourSlug: v.colourSlug,
        pricePaise: rupeesToPaise(v.price),
        images: v.images ?? [],
        inStock: v.inStock !== false,
        ...(features.length ? { features } : {}),
        ...(specifications.length ? { specifications } : {}),
        ...(materials.length ? { materials } : {}),
      };
    });

    const seenColours = new Set<string>();
    for (const v of variants) {
      if (seenColours.has(v.colourSlug)) {
        throw new Error(
          `Product ${row.id} has two variants with colour slug "${v.colourSlug}". ` +
            `Colour slugs address a variant in the URL, so they must be unique within a product.`,
        );
      }
      seenColours.add(v.colourSlug);
    }

    /*
      Per-finish features are all-or-nothing. With only some variants carrying
      them the page would show that finish's real list and fall back to the
      merged product-level one for the rest -- which is the exact bug this
      field exists to remove, reintroduced on a subset of the swatches and
      much harder to spot than the original.
    */
    const withFeatures = variants.filter((v) => v.features?.length).length;
    if (withFeatures !== 0 && withFeatures !== variants.length) {
      throw new Error(
        `Product ${row.id} sets per-variant features on ${withFeatures} of ` +
          `${variants.length} variants. Set them on every variant or none.`,
      );
    }

    const defaultVariant = variants[0];
    if (!defaultVariant) {
      throw new Error(`Product ${row.id} resolved to zero variants.`);
    }

    products.push({
      id: row.id,
      slug,
      name,
      shortName: (row.shortName ?? name).trim(),
      description: row.description.trim(),
      features: toFeatures(row.features ?? []),
      specifications: toSpecs(row.specifications ?? []),
      materials: toLines(row.materials ?? []),
      inTheBox: toLines(row.inTheBox ?? []),
      groupSlug,
      groupName: GROUP_META[groupSlug].name,
      subSlug,
      subName: row.subName?.trim() || sub?.name || titleCasePlural(subSlug),
      pricePaise: Math.min(...variants.map((v) => v.pricePaise)),
      inStock: variants.some((v) => v.inStock),
      images: row.images ?? defaultVariant.images,
      variants,
      reviews: (row.reviews ?? []).map(toReview),
      href: `/${groupSlug}/${slug}/`,
    });
  }

  const groups: Group[] = (Object.keys(GROUP_META) as GroupSlug[]).map(
    (groupSlug) => {
      const inGroup = products.filter((p) => p.groupSlug === groupSlug);

      const subSlugs = [...new Set(inGroup.map((p) => p.subSlug))];
      const subCategories: SubCategory[] = subSlugs.map((subSlug) => {
        const meta = SUB_META[subSlug];
        const inSub = inGroup.filter((p) => p.subSlug === subSlug);
        const onlyProduct = inSub.length === 1 ? inSub[0] : undefined;

        return {
          slug: subSlug,
          name: meta?.name ?? titleCasePlural(subSlug),
          description: meta?.description ?? "",
          groupSlug,
          products: inSub,
          href: `/${groupSlug}/${subSlug}/`,
          collapsed: onlyProduct?.slug === subSlug,
        };
      });

      return {
        slug: groupSlug,
        name: GROUP_META[groupSlug].name,
        description: GROUP_META[groupSlug].description,
        subCategories,
        products: inGroup,
        href: `/${groupSlug}/`,
      };
    },
  );

  assertNoRouteCollisions(groups);

  return { groups, products };
}

/**
 * Products and sub-categories share one URL shape -- /chairs/mesh-chair is a
 * sub-category and /chairs/neuro-mesh-chair is a product. That is only safe
 * while no product slug equals a sub-category slug inside the same group,
 * unless the sub-category is deliberately collapsed into that one product.
 *
 * Nothing in products.json enforces that, so it is enforced here. Failing the
 * build is the correct outcome: the alternative is one of the two pages
 * silently overwriting the other in the export.
 */
function assertNoRouteCollisions(groups: Group[]): void {
  const problems: string[] = [];

  for (const group of groups) {
    // A collapsed range yields its URL to its only product on purpose, so it
    // is not a claimant here. Every other range still is.
    const subSlugs = new Set(
      group.subCategories.filter((s) => !s.collapsed).map((s) => s.slug),
    );
    const seen = new Map<string, string>();

    for (const product of group.products) {
      if (subSlugs.has(product.slug)) {
        problems.push(
          `/${group.slug}/${product.slug} is both a sub-category and product ${product.id}`,
        );
      }

      const clash = seen.get(product.slug);
      if (clash) {
        problems.push(
          `/${group.slug}/${product.slug} is claimed by both ${clash} and ${product.id}`,
        );
      }
      seen.set(product.slug, product.id);
    }
  }

  if (problems.length) {
    throw new Error(
      `Route collisions in the catalog:\n  ${problems.join("\n  ")}\n` +
        `Rename the product or the sub-category so the URLs are distinct.`,
    );
  }
}

const catalog = build();

export const groups: Group[] = catalog.groups;
export const allProducts: Product[] = catalog.products;

export function getGroup(slug: string): Group | undefined {
  return groups.find((g) => g.slug === slug);
}

/**
 * Collapsed ranges are excluded: their URL belongs to their only product, and
 * returning one here would shadow that product page in the router.
 */
export function getSubCategory(
  groupSlug: string,
  subSlug: string,
): SubCategory | undefined {
  return getGroup(groupSlug)?.subCategories.find(
    (s) => s.slug === subSlug && !s.collapsed,
  );
}

export function getProduct(
  groupSlug: string,
  productSlug: string,
): Product | undefined {
  return allProducts.find(
    (p) => p.groupSlug === groupSlug && p.slug === productSlug,
  );
}

/** Legacy /product/<id> URLs, mapped to their new home for the redirect map. */
export function legacyRedirects(): { from: string; to: string }[] {
  return allProducts.map((p) => ({ from: `/product/${p.id}`, to: p.href }));
}

/**
 * Cheapest first, for the listing grids.
 *
 * Sorts on `pricePaise`, which is the lowest variant price, so a product is
 * ordered by the same "from" figure its card prints — sorting on anything
 * else would produce a grid whose visible numbers do not ascend. Equal prices
 * fall back to the name so the order is total and stable: an arbitrary
 * tie-break would reshuffle a listing between builds and invalidate the
 * cached HTML for no reason.
 *
 * Applied at the grids rather than inside `build()`, deliberately. Position
 * in `group.products` carries meaning elsewhere — the category hero is the
 * first product with a usable image, and the related-products rail takes the
 * first four — so sorting at the source would quietly change which product
 * fronts a category and which four are offered as alternatives.
 */
export function byPriceAscending(a: Product, b: Product): number {
  return a.pricePaise - b.pricePaise || a.name.localeCompare(b.name, "en");
}
