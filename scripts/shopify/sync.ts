/**
 * Pushes the local catalog into Shopify through the Admin GraphQL API.
 *
 *   npm run shopify:sync                 # dry run, writes nothing
 *   npm run shopify:sync -- --live --limit 1
 *   npm run shopify:sync -- --live
 *   npm run shopify:sync -- --live --publish
 *
 * Three deliberate safety properties:
 *
 *   1. Dry run is the default. Writing requires `--live`, typed by a human.
 *   2. Idempotent. Products are matched by handle, so a re-run updates rather
 *      than duplicates. It is safe to run after a partial failure.
 *   3. Products are created as DRAFT unless `--publish` is passed, so a
 *      mistake is invisible to shoppers and is reviewed in admin first.
 */

import {
  assertNoUserErrors,
  loadEnv,
  shopifyGraphql,
  type ShopifyEnv,
} from "./client";
import { buildCatalog, type ShopifyProduct } from "./payload";

const args = new Set(process.argv.slice(2));
const LIVE = args.has("--live");
const PUBLISH = args.has("--publish");
const RETRY_MEDIA = args.has("--retry-media");

const limitArg = process.argv.find((a) => a.startsWith("--limit"));
const LIMIT = limitArg
  ? Number(limitArg.split("=")[1] ?? process.argv[process.argv.indexOf(limitArg) + 1])
  : Infinity;

type ExistingProduct = {
  id: string;
  handle: string;
  mediaCount: number;
  variantId: string | null;
};

/**
 * Handle lookup via the search index rather than `productByHandle`, which has
 * been deprecated and re-shaped more than once across API versions.
 */
async function findByHandle(
  env: ShopifyEnv,
  handle: string,
): Promise<ExistingProduct | null> {
  const data = await shopifyGraphql<{
    products: {
      nodes: {
        id: string;
        handle: string;
        media: { nodes: { id: string }[] };
        variants: { nodes: { id: string }[] };
      }[];
    };
  }>(
    env,
    `query ByHandle($query: String!) {
       products(first: 1, query: $query) {
         nodes {
           id
           handle
           media(first: 50) { nodes { id } }
           variants(first: 1) { nodes { id } }
         }
       }
     }`,
    { query: `handle:'${handle}'` },
  );

  /* The search query is a fuzzy index, so confirm the handle matched exactly
   * rather than trusting the first hit. */
  const node = data.products.nodes.find((p) => p.handle === handle);
  if (!node) return null;

  return {
    id: node.id,
    handle: node.handle,
    mediaCount: node.media.nodes.length,
    variantId: node.variants.nodes[0]?.id ?? null,
  };
}

function productInput(product: ShopifyProduct): Record<string, unknown> {
  return {
    handle: product.handle,
    title: product.title,
    descriptionHtml: product.bodyHtml,
    vendor: product.vendor,
    productType: product.productType,
    tags: product.tags,
    status: PUBLISH ? "ACTIVE" : "DRAFT",
    seo: { title: product.seoTitle, description: product.seoDescription },
  };
}

const mediaInput = (product: ShopifyProduct): Record<string, unknown>[] =>
  product.images.map((image) => ({
    originalSource: image.src,
    alt: image.altText,
    mediaContentType: "IMAGE",
  }));

async function createProduct(
  env: ShopifyEnv,
  product: ShopifyProduct,
): Promise<ExistingProduct> {
  const data = await shopifyGraphql<{
    productCreate: {
      product: { id: string; handle: string; variants: { nodes: { id: string }[] } } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(
    env,
    `mutation Create($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
       productCreate(product: $product, media: $media) {
         product { id handle variants(first: 1) { nodes { id } } }
         userErrors { field message }
       }
     }`,
    { product: productInput(product), media: mediaInput(product) },
  );

  assertNoUserErrors(
    `productCreate(${product.handle})`,
    data.productCreate.userErrors,
  );
  const created = data.productCreate.product;
  if (!created) throw new Error(`productCreate(${product.handle}) returned no product.`);

  return {
    id: created.id,
    handle: created.handle,
    mediaCount: product.images.length,
    variantId: created.variants.nodes[0]?.id ?? null,
  };
}

async function updateProduct(
  env: ShopifyEnv,
  product: ShopifyProduct,
  existing: ExistingProduct,
): Promise<void> {
  const data = await shopifyGraphql<{
    productUpdate: {
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(
    env,
    `mutation Update($product: ProductUpdateInput!) {
       productUpdate(product: $product) { userErrors { field message } }
     }`,
    { product: { id: existing.id, ...productInput(product) } },
  );

  assertNoUserErrors(
    `productUpdate(${product.handle})`,
    data.productUpdate.userErrors,
  );

  /* Images are only added when the product has none. Re-running otherwise
   * would append a second copy of every photograph, and Shopify has no
   * "replace media" mutation to do this atomically. */
  if (existing.mediaCount === 0 && product.images.length > 0) {
    const media = await shopifyGraphql<{
      productCreateMedia: {
        mediaUserErrors: { field?: string[] | null; message: string }[];
      };
    }>(
      env,
      `mutation AddMedia($productId: ID!, $media: [CreateMediaInput!]!) {
         productCreateMedia(productId: $productId, media: $media) {
           mediaUserErrors { field message }
         }
       }`,
      { productId: existing.id, media: mediaInput(product) },
    );
    assertNoUserErrors(
      `productCreateMedia(${product.handle})`,
      media.productCreateMedia.mediaUserErrors,
    );
  }
}

/**
 * Price and SKU live on the variant, not the product. `tracked: false` is the
 * important part: a tracked variant sitting at zero stock refuses checkout,
 * and this is a reseller catalog with no live stock feed.
 */
async function setVariant(
  env: ShopifyEnv,
  product: ShopifyProduct,
  productId: string,
  variantId: string,
): Promise<void> {
  const data = await shopifyGraphql<{
    productVariantsBulkUpdate: {
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(
    env,
    `mutation SetVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
       productVariantsBulkUpdate(productId: $productId, variants: $variants) {
         userErrors { field message }
       }
     }`,
    {
      productId,
      variants: [
        {
          id: variantId,
          price: product.price,
          inventoryItem: { sku: product.sku, tracked: false },
        },
      ],
    },
  );

  assertNoUserErrors(
    `productVariantsBulkUpdate(${product.handle})`,
    data.productVariantsBulkUpdate.userErrors,
  );
}

/**
 * Shopify keeps "not archived" and "on sale" as separate states. `status:
 * ACTIVE` only means a product isn't draft or archived -- it stays invisible
 * to shoppers, and absent from the Storefront API the cart will run on, until
 * it is also published to the Online Store channel.
 */
async function onlineStorePublicationId(env: ShopifyEnv): Promise<string> {
  let data: { publications: { nodes: { id: string; name: string }[] } };
  try {
    data = await shopifyGraphql(
      env,
      `{ publications(first: 20) { nodes { id name } } }`,
    );
  } catch (error) {
    if (/access scope|access denied/i.test((error as Error).message)) {
      throw new Error(
        "Publishing needs the `write_publications` scope, which this app does not have.\n" +
          "In the Shopify dev dashboard open your app -> Configuration -> Access scopes,\n" +
          "add `write_publications`, release a new version, then run this again.",
      );
    }
    throw error;
  }

  const online = data.publications.nodes.find((node) =>
    node.name.toLowerCase().includes("online store"),
  );
  if (!online) {
    const found = data.publications.nodes.map((n) => n.name).join(", ");
    throw new Error(
      `This store has no Online Store channel. Channels found: ${found || "none"}`,
    );
  }
  return online.id;
}

async function publishToOnlineStore(
  env: ShopifyEnv,
  productId: string,
  publicationId: string,
): Promise<void> {
  const data = await shopifyGraphql<{
    publishablePublish: {
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(
    env,
    `mutation Publish($id: ID!, $input: [PublicationInput!]!) {
       publishablePublish(id: $id, input: $input) {
         userErrors { field message }
       }
     }`,
    { id: productId, input: [{ publicationId }] },
  );
  assertNoUserErrors(
    "publishablePublish",
    data.publishablePublish.userErrors,
  );
}

/**
 * Re-attaches images Shopify failed to download.
 *
 * Our origin is shared hosting, and Shopify's fetcher gives up on slow
 * responses -- the observed failures were "timeout reached" plus one truncated
 * file reported as corrupt, on images that all decode cleanly locally and
 * serve 200 on request. So these are transient and worth retrying.
 *
 * The whole gallery is replaced rather than just the broken entry, because
 * deleting one image and appending a replacement would reorder the rest, and
 * position 1 is the product's face: the collection thumbnail, the checkout
 * line-item image and the social card.
 */
async function retryFailedMedia(
  env: ShopifyEnv,
  catalog: ShopifyProduct[],
): Promise<void> {
  const byHandle = new Map(catalog.map((p) => [p.handle, p]));

  const data = await shopifyGraphql<{
    products: {
      nodes: {
        id: string;
        handle: string;
        media: { nodes: { id: string; status: string }[] };
      }[];
    };
  }>(
    env,
    `{
       products(first: 250) {
         nodes {
           id
           handle
           media(first: 50) { nodes { id status } }
         }
       }
     }`,
  );

  const damaged = data.products.nodes.filter(
    (p) =>
      byHandle.has(p.handle) &&
      p.media.nodes.some((m) => m.status === "FAILED"),
  );

  if (damaged.length === 0) {
    console.log("No failed media to retry.");
    return;
  }

  console.log(`Rebuilding galleries for ${damaged.length} product(s).\n`);

  let repaired = 0;
  const failures: string[] = [];

  for (const [index, product] of damaged.entries()) {
    const local = byHandle.get(product.handle)!;
    const position = `[${index + 1}/${damaged.length}]`;

    try {
      const mediaIds = product.media.nodes.map((m) => m.id);
      if (mediaIds.length) {
        const deleted = await shopifyGraphql<{
          productDeleteMedia: {
            mediaUserErrors: { field?: string[] | null; message: string }[];
          };
        }>(
          env,
          `mutation Wipe($productId: ID!, $mediaIds: [ID!]!) {
             productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
               mediaUserErrors { field message }
             }
           }`,
          { productId: product.id, mediaIds },
        );
        assertNoUserErrors(
          `productDeleteMedia(${product.handle})`,
          deleted.productDeleteMedia.mediaUserErrors,
        );
      }

      const added = await shopifyGraphql<{
        productCreateMedia: {
          mediaUserErrors: { field?: string[] | null; message: string }[];
        };
      }>(
        env,
        `mutation AddMedia($productId: ID!, $media: [CreateMediaInput!]!) {
           productCreateMedia(productId: $productId, media: $media) {
             mediaUserErrors { field message }
           }
         }`,
        { productId: product.id, media: mediaInput(local) },
      );
      assertNoUserErrors(
        `productCreateMedia(${product.handle})`,
        added.productCreateMedia.mediaUserErrors,
      );

      repaired += 1;
      console.log(
        `${position} rebuilt  ${product.handle} (${local.images.length} image(s))`,
      );
    } catch (error) {
      failures.push(`${product.handle}: ${(error as Error).message}`);
      console.log(`${position} FAILED   ${product.handle}`);
    }

    /* Deliberately unhurried. The failures are our origin being slow, so
     * firing the next batch immediately would make that worse. */
    await new Promise((done) => setTimeout(done, 1500));
  }

  console.log(`\nrebuilt ${repaired}, failed ${failures.length}`);
  if (failures.length) {
    console.log(`\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  } else {
    console.log(
      "Shopify downloads images asynchronously -- check with `npm run shopify:audit`\n" +
        "in a minute or two, and run this again if any are still FAILED.",
    );
  }
}

async function main(): Promise<void> {
  const catalog = buildCatalog().slice(0, LIMIT);

  if (RETRY_MEDIA) {
    if (!LIVE) {
      console.log("--retry-media rewrites product galleries. Add --live to apply.");
      return;
    }
    const env = loadEnv();
    console.log(`Retrying failed media on ${env.domain}\n`);
    await retryFailedMedia(env, buildCatalog());
    return;
  }

  if (!LIVE) {
    console.log("DRY RUN -- nothing will be written. Add --live to apply.\n");
    for (const product of catalog) {
      console.log(
        `  ${product.handle}\n` +
          `    title  ${product.title}\n` +
          `    type   ${product.productType}   tags: ${product.tags.join(", ")}\n` +
          `    sku    ${product.sku}   price: ${product.price}\n` +
          `    status ${PUBLISH ? "ACTIVE" : "DRAFT"}   images: ${product.images.length}\n` +
          `    image1 ${product.images[0]?.src ?? "(none)"}`,
      );
    }
    console.log(
      `\n${catalog.length} product(s) would be synced.\n` +
        "Verify the store first:  npm run shopify:preflight\n" +
        "Then try one for real:   npm run shopify:sync -- --live --limit 1",
    );
    return;
  }

  const env = loadEnv();
  console.log(
    `LIVE sync -> ${env.domain} (${env.apiVersion})\n` +
      `${catalog.length} product(s), created as ${PUBLISH ? "ACTIVE" : "DRAFT"}.\n`,
  );

  const publicationId = PUBLISH ? await onlineStorePublicationId(env) : null;

  let created = 0;
  let updated = 0;
  const failures: string[] = [];

  for (const [index, product] of catalog.entries()) {
    const position = `[${index + 1}/${catalog.length}]`;
    try {
      const existing = await findByHandle(env, product.handle);

      let target: ExistingProduct;
      if (existing) {
        await updateProduct(env, product, existing);
        target = existing;
        updated += 1;
        console.log(`${position} updated  ${product.handle}`);
      } else {
        target = await createProduct(env, product);
        created += 1;
        console.log(`${position} created  ${product.handle}`);
      }

      if (target.variantId) {
        await setVariant(env, product, target.id, target.variantId);
      } else {
        failures.push(`${product.handle}: no default variant, price not set`);
      }

      if (publicationId) {
        await publishToOnlineStore(env, target.id, publicationId);
      }
    } catch (error) {
      /* One bad product must not abandon the other 33. The run is idempotent,
       * so the fix is to correct the cause and run it again. */
      failures.push(`${product.handle}: ${(error as Error).message}`);
      console.log(`${position} FAILED   ${product.handle}`);
    }
  }

  console.log(`\ncreated ${created}, updated ${updated}, failed ${failures.length}`);
  if (failures.length) {
    console.log(`\nFailures:\n  ${failures.join("\n  ")}`);
    console.log("\nSync is idempotent -- fix the cause and run it again.");
    process.exitCode = 1;
    return;
  }
  console.log(
    PUBLISH
      ? "\nProducts are ACTIVE and published to the Online Store.\nVerify with `npm run shopify:audit`."
      : "\nProducts are DRAFT. Review them in Shopify admin, then re-run with --publish.",
  );
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}`);
  process.exitCode = 1;
});
