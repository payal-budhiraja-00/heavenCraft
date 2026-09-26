/**
 * Writes the printed MRP onto every Shopify variant as its compare-at price.
 *
 *   npx tsx scripts/shopify/set-compare-at.ts            # dry run, prints a plan
 *   npx tsx scripts/shopify/set-compare-at.ts --apply    # writes
 *   npx tsx scripts/shopify/set-compare-at.ts --apply --force
 *
 * ## Why this is separate from `sync.ts`
 *
 * `sync.ts` sends a whole `ProductSetInput` -- title, description, options,
 * media -- and re-uploading a catalogue of photographs to change one number
 * per variant is a lot of moving parts to disturb for a price edit. This
 * touches `productVariantsBulkUpdate` and nothing else, so the blast radius
 * of a pricing change is pricing.
 *
 * `payload.ts` still carries `compareAtPrice`, so a future full sync sets it
 * too and the two paths agree.
 *
 * ## Why it will not overwrite by default
 *
 * Shopify is the source of truth for the MRP once seeded -- the whole point
 * of keeping it out of the repo is that it can be corrected in the admin. A
 * variant that already carries a compare-at price is therefore left alone
 * unless `--force` is passed, so re-running this is safe and does not quietly
 * revert a hand-set figure.
 */

import { allProducts } from "../../src/lib/catalog";
import { paiseToPriceString } from "../../src/lib/money";
import {
  assertNoUserErrors,
  loadEnv,
  shopifyGraphql,
  type ShopifyEnv,
} from "./client";
import { MAX_PERCENT, MIN_PERCENT, compareAtFor } from "./pricing";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

type RemoteVariant = {
  id: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
};

type RemoteProduct = { id: string; handle: string; variants: { nodes: RemoteVariant[] } };

type Page = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: RemoteProduct[];
  };
};

const QUERY = `
  query Variants($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        variants(first: 50) {
          nodes { id sku price compareAtPrice }
        }
      }
    }
  }
`;

const MUTATION = `
  mutation SetCompareAt($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id sku compareAtPrice }
      userErrors { field message }
    }
  }
`;

async function fetchAll(env: ShopifyEnv): Promise<RemoteProduct[]> {
  const all: RemoteProduct[] = [];
  let cursor: string | null = null;

  for (;;) {
    const page: Page = await shopifyGraphql<Page>(env, QUERY, { cursor });
    all.push(...page.products.nodes);
    if (!page.products.pageInfo.hasNextPage) break;
    cursor = page.products.pageInfo.endCursor;
  }

  return all;
}

const inr = (paise: number) => `Rs ${(paise / 100).toLocaleString("en-IN")}`;

async function main() {
  const env = loadEnv();
  const remote = await fetchAll(env);

  /* Look up by SKU rather than by handle and position. A SKU is the variant
   * `id` from products.json and is what every other script here keys on;
   * positions shift whenever a colourway is added. */
  const remoteBySku = new Map<string, { product: RemoteProduct; variant: RemoteVariant }>();
  for (const product of remote) {
    for (const variant of product.variants.nodes) {
      if (variant.sku) remoteBySku.set(variant.sku, { product, variant });
    }
  }

  const planned = new Map<string, { id: string; compareAtPrice: string }[]>();
  const skipped: string[] = [];
  const missing: string[] = [];
  const rows: string[] = [];
  let refused = 0;

  for (const product of allProducts) {
    for (const variant of product.variants) {
      const found = remoteBySku.get(variant.id);
      if (!found) {
        missing.push(`${variant.id} (${product.slug})`);
        continue;
      }

      const seed = compareAtFor(
        product.id,
        product.groupSlug,
        variant.id,
        variant.pricePaise,
      );

      /* The guard that matters. Everything upstream is arithmetic on a hash,
       * and arithmetic on a hash is exactly the kind of thing that is correct
       * until someone edits a band. Nothing leaves this process claiming a
       * saving outside the range the printed MRP supports. */
      if (seed.percentOff < MIN_PERCENT || seed.percentOff > MAX_PERCENT) {
        console.error(
          `refusing ${variant.id}: ${seed.percentOff}% is outside ${MIN_PERCENT}-${MAX_PERCENT}%`,
        );
        refused += 1;
        continue;
      }

      /* Shopify is authoritative once seeded. An existing value is someone's
       * decision until proven otherwise. */
      if (found.variant.compareAtPrice && !FORCE) {
        skipped.push(
          `${variant.id} already set to Rs ${found.variant.compareAtPrice}`,
        );
        continue;
      }

      const list = planned.get(found.product.id) ?? [];
      list.push({
        id: found.variant.id,
        compareAtPrice: paiseToPriceString(seed.comparePaise),
      });
      planned.set(found.product.id, list);

      rows.push(
        `${variant.id.padEnd(44)}${inr(variant.pricePaise).padStart(12)}` +
          `${inr(seed.comparePaise).padStart(12)}${`${seed.percentOff}%`.padStart(6)}`,
      );
    }
  }

  for (const row of rows) console.log(row);

  const count = [...planned.values()].reduce((n, v) => n + v.length, 0);
  console.log(`\nvariants to update : ${count}`);
  console.log(`already set        : ${skipped.length}${FORCE ? " (overwriting, --force)" : " (left alone)"}`);
  console.log(`not in Shopify     : ${missing.length}`);
  console.log(`refused by guard   : ${refused}`);

  for (const line of skipped) console.log(`  skip ${line}`);
  for (const line of missing) console.log(`  gone ${line}`);

  if (refused) {
    console.error("\nrefusing to write while any variant is outside the guard.");
    process.exitCode = 1;
    return;
  }

  if (!APPLY) {
    console.log("\nDry run. Nothing written. Re-run with --apply to write.");
    return;
  }

  let written = 0;
  for (const [productId, variants] of planned) {
    const data = await shopifyGraphql<{
      productVariantsBulkUpdate: {
        productVariants: { id: string }[] | null;
        userErrors: { field?: string[] | null; message: string }[];
      };
    }>(env, MUTATION, { productId, variants });

    assertNoUserErrors(
      `productVariantsBulkUpdate(${productId})`,
      data.productVariantsBulkUpdate.userErrors,
    );
    written += data.productVariantsBulkUpdate.productVariants?.length ?? 0;
  }

  console.log(`\nwritten: ${written} variant(s)`);
  console.log("Now run `npm run shopify:variant-ids` to read them back.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
