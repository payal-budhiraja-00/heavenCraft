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
  Group,
  GroupSlug,
  Product,
  Review,
  SubCategory,
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

type RawProduct = {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  price: number;
  currency: string;
  rating?: number;
  description: string;
  features?: string[];
  images?: string[];
  inStock?: boolean;
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
      "Mesh, fabric and leather task chairs built to be sat in for eight hours, not looked at for five minutes.",
  },
  tables: {
    name: "Tables",
    description:
      "Height-adjustable, executive, study and folding desks for workspaces that have to earn their footprint.",
  },
  accessories: {
    name: "Accessories",
    description:
      "Monitor stands, footrests, cable trays and the small hardware that decides whether a desk actually works.",
  },
};

/**
 * Display names for sub-categories. A naive title-case would give "Cpu Stand"
 * and "Storage Boxs", so the irregular ones are named explicitly and the rest
 * fall through to a derived plural.
 */
const SUB_META: Record<string, { name: string; description: string }> = {
  "mesh-chair": {
    name: "Mesh Chairs",
    description:
      "Breathable mesh backs that stay cool through a full working day.",
  },
  "fabric-chair": {
    name: "Fabric Chairs",
    description: "Upholstered task chairs with padded, longer-wearing support.",
  },
  "leather-chair": {
    name: "Leather Chairs",
    description: "Executive leather seating for meeting rooms and cabins.",
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
  "storage-box": {
    name: "Storage Boxes",
    description: "Under-desk storage that keeps the floor clear.",
  },
  footrest: {
    name: "Footrests",
    description:
      "Angled footrests that fix hip angle when the chair is at the right height but the floor is not.",
  },
  "cable-tray": {
    name: "Cable Trays",
    description: "Under-desk cable management for a desk that can still move.",
  },
  "cpu-stand": {
    name: "CPU Stands",
    description: "Mobile stands that lift a tower off the floor.",
  },
  "monitor-stand": {
    name: "Monitor Stands",
    description: "Risers that bring a screen up to eye height.",
  },
  "cup-holder": {
    name: "Cup Holders",
    description: "Clamp-on holders that keep a drink off the work surface.",
  },
  "desk-hook": {
    name: "Desk Hooks",
    description: "Side-mounted hooks for bags, headphones and cables.",
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

    products.push({
      id: row.id,
      slug,
      name,
      description: row.description.trim(),
      features: (row.features ?? []).map((f) => f.trim()),
      groupSlug,
      groupName: GROUP_META[groupSlug].name,
      subSlug,
      subName: sub?.name ?? titleCasePlural(subSlug),
      pricePaise: rupeesToPaise(row.price),
      inStock: row.inStock !== false,
      images: row.images ?? [],
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
        return {
          slug: subSlug,
          name: meta?.name ?? titleCasePlural(subSlug),
          description: meta?.description ?? "",
          groupSlug,
          products: inGroup.filter((p) => p.subSlug === subSlug),
          href: `/${groupSlug}/${subSlug}/`,
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
 * while no product slug equals a sub-category slug inside the same group.
 *
 * Nothing in products.json enforces that, so it is enforced here. Failing the
 * build is the correct outcome: the alternative is one of the two pages
 * silently overwriting the other in the export.
 */
function assertNoRouteCollisions(groups: Group[]): void {
  const problems: string[] = [];

  for (const group of groups) {
    const subSlugs = new Set(group.subCategories.map((s) => s.slug));
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

export function getSubCategory(
  groupSlug: string,
  subSlug: string,
): SubCategory | undefined {
  return getGroup(groupSlug)?.subCategories.find((s) => s.slug === subSlug);
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
