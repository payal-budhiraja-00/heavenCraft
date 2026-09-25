/**
 * Reads products back out of Shopify and compares them to the local catalog.
 *
 *   npm run shopify:audit
 *
 * A successful mutation is not proof of a correct product: images are fetched
 * asynchronously after the API returns OK, so a photo can still fail to
 * download minutes later, and a variant can be created with the wrong price
 * without anything erroring. This reads the truth back.
 *
 * Read-only.
 */

import { loadEnv, shopifyGraphql, type ShopifyEnv } from "./client";
import { buildCatalog, type ShopifyProduct } from "./payload";

type RemoteProduct = {
  handle: string;
  title: string;
  status: string;
  onlineStoreUrl: string | null;
  descriptionHtml: string;
  seo: { title: string | null; description: string | null };
  media: { nodes: { status: string; alt: string | null }[] };
  variants: {
    nodes: {
      price: string;
      sku: string | null;
      inventoryItem: { tracked: boolean };
    }[];
  };
};
async function fetchAll(env: ShopifyEnv): Promise<Map<string, RemoteProduct>> {
  const out = new Map<string, RemoteProduct>();
  let cursor: string | null = null;

  for (;;) {
    const data: {
      products: {
        nodes: RemoteProduct[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await shopifyGraphql(
      env,
      `query All($cursor: String) {
         products(first: 50, after: $cursor) {
           nodes {
             handle
             title
             status
             onlineStoreUrl
             descriptionHtml
             seo { title description }
             media(first: 50) { nodes { ... on MediaImage { status alt } } }
             variants(first: 50) {
               nodes { price sku inventoryItem { tracked } }
             }
           }
           pageInfo { hasNextPage endCursor }
         }
       }`,
      { cursor },
    );

    for (const node of data.products.nodes) out.set(node.handle, node);
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  return out;
}

/**
 * The visible text of a fragment of HTML, normalised.
 *
 * Shopify does not store the markup it is handed byte for byte, so comparing
 * `descriptionHtml` directly reports a difference on a product that is
 * perfectly in sync. What matters is whether the store is telling shoppers the
 * same thing the catalog says, and that survives the rewriting.
 */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function compare(
  local: ShopifyProduct,
  remote: RemoteProduct | undefined,
): string[] {
  if (!remote) return ["missing from Shopify"];

  const problems: string[] = [];

  if (remote.title !== local.title) {
    problems.push(`title "${remote.title}" != "${local.title}"`);
  }

  /*
    The description is the field most likely to drift silently: nothing about a
    stale one looks broken, so it survives every other check here. It is also
    the field that carries the per-finish feature sheets, where being out of
    date means the store asserts something about the product that is not true
    -- a fixed wooden footrest advertising massage rollers, say. Shopify
    rewrites the markup it is given (it re-orders attributes and normalises
    whitespace), so an exact string comparison would cry wolf on every run;
    comparing the text content catches a stale description without that.
  */
  if (textOf(remote.descriptionHtml) !== textOf(local.bodyHtml)) {
    problems.push("description differs from the catalog -- re-run the sync");
  }

  /* Matched by SKU rather than by position. Shopify does not promise variant
   * order, and a mismatch found by index would report every colourway of a
   * reordered product as wrong while saying nothing about what is actually
   * missing. */
  const remoteBySku = new Map(
    remote.variants.nodes
      .filter((v) => v.sku)
      .map((v) => [v.sku as string, v] as const),
  );

  if (remote.variants.nodes.length === 0) {
    problems.push("no variants, so it cannot be bought");
  }

  for (const wanted of local.variants) {
    const variant = remoteBySku.get(wanted.sku);
    if (!variant) {
      problems.push(`no variant with sku "${wanted.sku}" (${wanted.colour})`);
      continue;
    }
    /* Shopify normalises 13999.00 to 13999.0, so compare numerically. */
    if (Number(variant.price) !== Number(wanted.price)) {
      problems.push(`${wanted.colour}: price ${variant.price} != ${wanted.price}`);
    }
    /* A tracked variant at zero stock refuses checkout, which for a reseller
     * means a silently unbuyable product. */
    if (variant.inventoryItem.tracked) {
      problems.push(
        `${wanted.colour}: inventory is TRACKED -- checkout will block at zero stock`,
      );
    }
  }

  /* A variant we no longer sell is still buyable, and is the shape a botched
   * rename leaves behind. */
  const wantedSkus = new Set(local.variants.map((v) => v.sku));
  for (const variant of remote.variants.nodes) {
    if (!variant.sku) {
      problems.push("a variant has no SKU, so an order line cannot be traced to it");
    } else if (!wantedSkus.has(variant.sku)) {
      problems.push(`extra variant "${variant.sku}" is not in the catalog`);
    }
  }

  /* ACTIVE only means "not draft or archived". Without an Online Store
   * publication the product is still invisible to shoppers and missing from
   * the Storefront API, while admin shows it as live. */
  if (remote.status === "ACTIVE" && !remote.onlineStoreUrl) {
    problems.push("ACTIVE but not on the Online Store -- shoppers cannot see it");
  }

  const ready = remote.media.nodes.filter((m) => m.status === "READY").length;
  const failed = remote.media.nodes.filter((m) => m.status === "FAILED").length;
  const pending = remote.media.nodes.length - ready - failed;

  if (failed > 0) problems.push(`${failed} image(s) FAILED to download`);
  if (remote.media.nodes.length !== local.images.length) {
    problems.push(
      `${remote.media.nodes.length} image(s) attached, expected ${local.images.length}`,
    );
  }
  if (pending > 0) problems.push(`${pending} image(s) still processing`);

  if (!remote.seo.description) problems.push("no SEO description");

  return problems;
}

async function main(): Promise<void> {
  const env = loadEnv();
  console.log(`Auditing ${env.domain} against the local catalog.\n`);

  const local = buildCatalog();
  const remote = await fetchAll(env);

  let clean = 0;
  const broken: string[] = [];
  const statuses = new Map<string, number>();

  for (const product of local) {
    const match = remote.get(product.handle);
    if (match) {
      statuses.set(match.status, (statuses.get(match.status) ?? 0) + 1);
    }

    const problems = compare(product, match);
    if (problems.length === 0) {
      clean += 1;
    } else {
      broken.push(`${product.handle}\n    - ${problems.join("\n    - ")}`);
    }
  }

  console.log(`${clean}/${local.length} products match the catalog exactly.`);
  if (statuses.size) {
    console.log(
      `status: ${[...statuses].map(([s, n]) => `${n} ${s}`).join(", ")}`,
    );
  }

  const extra = [...remote.keys()].filter(
    (handle) => !local.some((p) => p.handle === handle),
  );
  if (extra.length) {
    console.log(
      `\n${extra.length} product(s) in Shopify but not in our catalog: ${extra.join(", ")}`,
    );
  }

  if (broken.length) {
    console.log(`\n${broken.length} with problems:\n  ${broken.join("\n  ")}`);
    console.log(
      "\nImages still processing are usually fine -- re-run in a minute.",
    );
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}`);
  process.exitCode = 1;
});
