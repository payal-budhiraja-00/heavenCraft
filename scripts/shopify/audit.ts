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
             variants(first: 1) {
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

function compare(
  local: ShopifyProduct,
  remote: RemoteProduct | undefined,
): string[] {
  if (!remote) return ["missing from Shopify"];

  const problems: string[] = [];
  const variant = remote.variants.nodes[0];

  if (remote.title !== local.title) {
    problems.push(`title "${remote.title}" != "${local.title}"`);
  }
  if (!variant) {
    problems.push("no variant, so it cannot be bought");
  } else {
    /* Shopify normalises 13999.00 to 13999.0, so compare numerically. */
    if (Number(variant.price) !== Number(local.price)) {
      problems.push(`price ${variant.price} != ${local.price}`);
    }
    if (variant.sku !== local.sku) {
      problems.push(`sku "${variant.sku ?? ""}" != "${local.sku}"`);
    }
    /* A tracked variant at zero stock refuses checkout, which for a reseller
     * means a silently unbuyable product. */
    if (variant.inventoryItem.tracked) {
      problems.push("inventory is TRACKED -- checkout will block at zero stock");
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
