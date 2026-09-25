/**
 * URLs that used to resolve and no longer do.
 *
 * Two separate waves of history are answered here.
 *
 * The first is the React Router site, which addressed products as
 * `/product/<id>`. Those are generated from the catalog in
 * `generate-htaccess.ts` and are not listed in this file.
 *
 * The second is the September 2026 range change, and it is what this file is
 * for. Sixteen products were withdrawn, six ranges emptied, and seven products
 * were renamed -- and a rename changes the URL, because the slug is derived
 * from the name. Every one of those URLs was served with a 200 by this site
 * for months and is in Google's index and in customers' bookmarks. Dropping
 * them would turn real traffic into 404s and throw away whatever ranking the
 * pages had earned.
 *
 * A 301 also passes ranking signal to the target, so the target is chosen to
 * be the nearest thing the shop actually sells rather than the homepage. Where
 * a near-identical product survives -- Modura, Quantum -- the redirect goes to
 * it. Where the whole line is gone -- the leather chairs -- it goes to the
 * group page, which is the closest honest answer. Sending everything to `/`
 * would be a soft 404 and Google treats it as one.
 *
 * Kept as data, and asserted against the export in `verify-export.ts`, because
 * a redirect that points at a page which no longer exists is worse than no
 * redirect: it 404s after an extra round trip and is invisible in testing.
 */

export type LegacyRedirect = {
  from: string;
  to: string;
  /** Why this target, in the cases where it is a judgement rather than a rename. */
  note?: string;
};

/** Withdrawn products, addressed by their old `/product/<id>` URL. */
export const RETIRED_PRODUCT_IDS: readonly string[] = [
  "chair-leather-002",
  "chair-leather-003",
  "chair-leather-005",
  "chair-fabric-001",
  "chair-fabric-005",
  "table-bed-003",
  "table-height-adjustable-003",
  "table-gaming-desk-002",
  "accessories-storage-box-002",
  "accessories-storage-box-004",
  "accessories-footrest-002",
  "accessories-Cpu-Stand-002",
  "accessories-Cpu-Stand-003",
  "accessories-monitor-stand-001",
  "accessories-monitor-stand-004",
  "accessories-desk-hook-001",
  "accessories-desk-hook-002",
];

/**
 * Where each retired product sends its visitors. Keyed by the same id as
 * above so the two cannot drift; the pretty URL is derived from it below.
 */
const RETIRED: Record<string, { slug: string; group: string; to: string; note: string }> =
  {
    "chair-leather-002": {
      slug: "rider-leather-chair",
      group: "chairs",
      to: "/chairs/",
      note: "The leather line was withdrawn entirely; there is no equivalent chair.",
    },
    "chair-leather-003": {
      slug: "nexor-leather-chair",
      group: "chairs",
      to: "/chairs/",
      note: "The leather line was withdrawn entirely; there is no equivalent chair.",
    },
    "chair-leather-005": {
      slug: "valerio-leather-chair",
      group: "chairs",
      to: "/chairs/",
      note: "The leather line was withdrawn entirely; there is no equivalent chair.",
    },
    "chair-fabric-001": {
      slug: "fabio-fabric-chair",
      group: "chairs",
      to: "/chairs/performance-mesh-chair/",
      note: "The fabric range became the performance mesh range -- Casca moved across under the same id.",
    },
    "chair-fabric-005": {
      slug: "niyo-fabric-chair",
      group: "chairs",
      to: "/chairs/performance-mesh-chair/",
      note: "The fabric range became the performance mesh range -- Casca moved across under the same id.",
    },
    "table-bed-003": {
      slug: "flexon-bed-table",
      group: "tables",
      to: "/tables/bed-table/",
      note: "Replaced within the same range by the Flex Apex.",
    },
    "table-height-adjustable-003": {
      slug: "modura-primex-height-adjustable-table",
      group: "tables",
      to: "/tables/modura-height-adjustable-table/",
      note: "The Primex variant was dropped; the standard Modura is the same table.",
    },
    "table-gaming-desk-002": {
      slug: "quantum-primex-gaming-desk",
      group: "tables",
      to: "/tables/quantum-gaming-desk/",
      note: "The Primex variant was dropped; the standard Quantum is the same desk.",
    },
    "accessories-storage-box-002": {
      slug: "storage-box-plus",
      group: "accessories",
      to: "/accessories/",
      note: "Storage boxes were withdrawn; nothing in the range replaces them.",
    },
    "accessories-storage-box-004": {
      slug: "storage-box-pro-max",
      group: "accessories",
      to: "/accessories/",
      note: "Storage boxes were withdrawn; nothing in the range replaces them.",
    },
    "accessories-footrest-002": {
      slug: "footrest-plus",
      group: "accessories",
      to: "/accessories/footrest/",
      note: "Basic and Plus merged into one footrest sold in three finishes, so the tiers are now colourways of a single product.",
    },
    "accessories-Cpu-Stand-002": {
      slug: "cpu-stand-plus",
      group: "accessories",
      to: "/accessories/",
      note: "CPU stands were withdrawn; nothing in the range replaces them.",
    },
    "accessories-Cpu-Stand-003": {
      slug: "cpu-stand-pro",
      group: "accessories",
      to: "/accessories/",
      note: "CPU stands were withdrawn; nothing in the range replaces them.",
    },
    "accessories-monitor-stand-001": {
      slug: "monitor-stand-basic",
      group: "accessories",
      to: "/accessories/desk-shelf-tray/",
      note: "The desk shelf tray is what now lifts a monitor off the desk, so it is the nearest thing to what this visitor came for.",
    },
    "accessories-monitor-stand-004": {
      slug: "monitor-stand-pro-max",
      group: "accessories",
      to: "/accessories/desk-shelf-tray/",
      note: "The desk shelf tray is what now lifts a monitor off the desk, so it is the nearest thing to what this visitor came for.",
    },
    "accessories-desk-hook-001": {
      slug: "desk-hook-basic",
      group: "accessories",
      to: "/accessories/",
      note: "Desk hooks were withdrawn; the peg-board ships with hooks but is not a substitute for one.",
    },
    "accessories-desk-hook-002": {
      slug: "desk-hook-plus",
      group: "accessories",
      to: "/accessories/",
      note: "Desk hooks were withdrawn; the peg-board ships with hooks but is not a substitute for one.",
    },
  };

/**
 * Products that survived the range change under a new name.
 *
 * The id is unchanged, so `/product/<id>` keeps working through the generated
 * redirects. What breaks is the pretty URL, because the slug comes from the
 * name -- and these are the URLs that are actually linked and indexed.
 *
 * The same rename moves the product's Shopify handle, which is also the slug.
 * Recorded once here and consumed by both `generate-htaccess.ts` and the
 * Shopify sync, so the shop and the site cannot disagree about which product
 * a name refers to.
 */
export const RENAMED: readonly { group: string; from: string; to: string }[] = [
  { group: "chairs", from: "casca-fabric-chair", to: "casca-performance-mesh-chair" },
  { group: "tables", from: "exquisite-primex-folding-table", to: "exquisite-folding-table" },
  {
    group: "tables",
    from: "modulus-primex-height-adjustable-table",
    to: "modulus-height-adjustable-table",
  },
  { group: "tables", from: "zenvy-primex-study-table", to: "zenvy-study-table" },
  { group: "accessories", from: "footrest-basic", to: "footrest" },
  { group: "accessories", from: "cable-tray-basic", to: "cable-management-tray" },
  { group: "accessories", from: "cup-holder-basic", to: "cup-holder" },
];

/** Shopify handles of withdrawn products, for archiving. */
export const RETIRED_HANDLES: readonly string[] = RETIRED_PRODUCT_IDS.map(
  (id) => RETIRED[id]!.slug,
);

/**
 * Range pages that no longer exist because every product in them was
 * withdrawn. These were real listing pages with their own copy and their own
 * place in the sitemap.
 */
const EMPTIED_RANGES: readonly LegacyRedirect[] = [
  {
    from: "/chairs/leather-chair",
    to: "/chairs/",
    note: "No leather chairs remain.",
  },
  {
    from: "/chairs/fabric-chair",
    to: "/chairs/performance-mesh-chair/",
    note: "The range was renamed and re-specified rather than dropped.",
  },
  { from: "/accessories/storage-box", to: "/accessories/" },
  { from: "/accessories/cpu-stand", to: "/accessories/" },
  {
    from: "/accessories/monitor-stand",
    to: "/accessories/desk-shelf-tray/",
    note: "Nearest surviving product, as above.",
  },
  { from: "/accessories/desk-hook", to: "/accessories/" },
];

/**
 * Everything above as a flat list, in the order it should appear in the
 * generated file: withdrawn product ids, then their pretty URLs, then
 * renames, then emptied ranges.
 */
export const LEGACY_REDIRECTS: readonly LegacyRedirect[] = [
  ...RETIRED_PRODUCT_IDS.map((id) => {
    const entry = RETIRED[id];
    if (!entry) throw new Error(`no redirect target recorded for retired product ${id}`);
    return { from: `/product/${id}`, to: entry.to, note: entry.note };
  }),
  ...RETIRED_PRODUCT_IDS.map((id) => {
    const entry = RETIRED[id]!;
    return { from: `/${entry.group}/${entry.slug}`, to: entry.to };
  }),
  ...RENAMED.map(({ group, from, to }) => ({
    from: `/${group}/${from}`,
    to: `/${group}/${to}/`,
  })),
  ...EMPTIED_RANGES,
];
