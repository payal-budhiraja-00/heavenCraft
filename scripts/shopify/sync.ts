/**
 * Pushes the local catalog into Shopify through the Admin GraphQL API.
 *
 *   npm run shopify:sync                 # dry run, writes nothing
 *   npm run shopify:sync -- --live --limit 1
 *   npm run shopify:sync -- --live
 *   npm run shopify:sync -- --live --publish
 *   npm run shopify:sync -- --live --retire          # archive withdrawn products
 *   npm run shopify:sync -- --live --replace-media   # re-fetch every photograph
 *
 * Three deliberate safety properties:
 *
 *   1. Dry run is the default. Writing requires `--live`, typed by a human.
 *   2. Idempotent. Products are matched by handle, so a re-run updates rather
 *      than duplicates. It is safe to run after a partial failure.
 *   3. Products are created as DRAFT unless `--publish` is passed, so a
 *      mistake is invisible to shoppers and is reviewed in admin first.
 *
 * ## Why `productSet` for everything except media
 *
 * The September 2026 range change made several products multi-colour, which
 * means converting a Shopify product from its implicit single "Title /
 * Default Title" variant to a real "Colour" option with two or three variants
 * under it. `productSet` is the mutation designed for that: it is declarative
 * over options and variants, so it performs the migration and stays
 * idempotent afterwards, and it takes `identifier: { handle: ... }` so the
 * same call creates or updates.
 *
 * Media is deliberately NOT passed through `productSet.files`. Shopify's own
 * documentation never states whether omitting `files` preserves or deletes
 * existing media -- the mutation describes destructive replace semantics for
 * "list fields" and names `variants`, `collections` and `metafields` as
 * examples but never says which bucket `files` is in. There are also open
 * community reports of repeated `productSet` calls toggling product media in
 * and out of existence, and of re-sent `originalSource` URLs being re-uploaded
 * as duplicates because `FileSetInput.duplicateResolutionMode` defaults to
 * `APPEND_UUID`. Media is the slow, expensive, hard-to-rebuild half of this
 * catalog, so it goes through `productCreateMedia`, whose additive behaviour
 * is documented, and only when a product has none.
 */

import {
  assertNoUserErrors,
  loadEnv,
  shopifyGraphql,
  type ShopifyEnv,
} from "./client";
import { buildCatalog, type ShopifyProduct } from "./payload";
import { RETIRED_HANDLES } from "../legacy-redirects";

const args = new Set(process.argv.slice(2));
const LIVE = args.has("--live");
const PUBLISH = args.has("--publish");
const RETRY_MEDIA = args.has("--retry-media");
const REPLACE_MEDIA = args.has("--replace-media");
const RETIRE = args.has("--retire");

/** Shopify's option name for the colourway. */
const COLOUR_OPTION = "Colour";

const limitArg = process.argv.find((a) => a.startsWith("--limit"));
const LIMIT = limitArg
  ? Number(limitArg.split("=")[1] ?? process.argv[process.argv.indexOf(limitArg) + 1])
  : Infinity;

type ExistingProduct = {
  id: string;
  handle: string;
  mediaCount: number;
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
      }[];
    };
  }>(
    env,
    `query ByHandle($query: String!) {
       products(first: 5, query: $query) {
         nodes {
           id
           handle
           media(first: 50) { nodes { id } }
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
  };
}

/**
 * Finds the product a rename left behind.
 *
 * Seven products survived the range change under a new name, and the handle
 * is derived from the name. Without this the sync would not find them under
 * their new handle, would create a second Shopify product, and would leave
 * the original sitting in the admin with the old name and the old price.
 */
async function findRenamed(
  env: ShopifyEnv,
  product: ShopifyProduct,
): Promise<ExistingProduct | null> {
  if (!product.previousHandle) return null;
  return findByHandle(env, product.previousHandle);
}

/**
 * The declarative half of a product: everything except media.
 *
 * `productOptions` and `variants` are supplied together because Shopify
 * rejects one without the other (`PRODUCT_OPTIONS_INPUT_MISSING` /
 * `VARIANTS_INPUT_MISSING`), and both are replaced wholesale -- which is what
 * converts a single "Default Title" variant into real colourways.
 *
 * `tracked: false` is the important part of the variant: a tracked variant
 * sitting at zero stock refuses checkout, and this is a reseller catalog with
 * no live stock feed.
 */
function productSetInput(
  product: ShopifyProduct,
  existingId: string | null,
): Record<string, unknown> {
  return {
    ...(existingId ? { id: existingId } : {}),
    handle: product.handle,
    // Only meaningful when the handle is changing; harmless otherwise, and it
    // is what stops a rename from 404ing the old Shopify product URL.
    redirectNewHandle: true,
    title: product.title,
    descriptionHtml: product.bodyHtml,
    vendor: product.vendor,
    productType: product.productType,
    tags: product.tags,
    status: PUBLISH ? "ACTIVE" : "DRAFT",
    seo: { title: product.seoTitle, description: product.seoDescription },
    productOptions: [
      {
        name: COLOUR_OPTION,
        position: 1,
        values: product.variants.map((variant) => ({ name: variant.colour })),
      },
    ],
    variants: product.variants.map((variant) => ({
      price: variant.price,
      // Shopify shows its own "Sale" badge and struck-through price from this
      // field, so setting it here means the storefront, the cart and the
      // checkout all agree with the website without any further wiring.
      compareAtPrice: variant.compareAtPrice,
      optionValues: [{ optionName: COLOUR_OPTION, name: variant.colour }],
      sku: variant.sku,
      inventoryItem: { tracked: false },
    })),
  };
}

const mediaInput = (product: ShopifyProduct): Record<string, unknown>[] =>
  product.images.map((image) => ({
    originalSource: image.src,
    alt: image.altText,
    mediaContentType: "IMAGE",
  }));

/**
 * Creates or updates one product.
 *
 * A rename is resolved first, by id, because identifying a product by its old
 * handle while simultaneously setting a new one is what `INPUT_MISMATCH` is
 * for.
 */
async function upsertProduct(
  env: ShopifyEnv,
  product: ShopifyProduct,
): Promise<{ target: ExistingProduct; created: boolean; renamedFrom?: string }> {
  const current = await findByHandle(env, product.handle);
  const renamed = current ? null : await findRenamed(env, product);
  const existing = current ?? renamed;

  const data = await shopifyGraphql<{
    productSet: {
      product: { id: string; handle: string } | null;
      userErrors: { field?: string[] | null; message: string; code?: string }[];
    };
  }>(
    env,
    `mutation Set($input: ProductSetInput!) {
       productSet(input: $input, synchronous: true) {
         product { id handle }
         userErrors { field message code }
       }
     }`,
    { input: productSetInput(product, existing?.id ?? null) },
  );

  assertNoUserErrors(`productSet(${product.handle})`, data.productSet.userErrors);
  const saved = data.productSet.product;
  if (!saved) throw new Error(`productSet(${product.handle}) returned no product.`);

  return {
    target: {
      id: saved.id,
      handle: saved.handle,
      mediaCount: existing?.mediaCount ?? 0,
    },
    created: !existing,
    ...(renamed ? { renamedFrom: renamed.handle } : {}),
  };
}

/**
 * Attaches the gallery, but only to a product that has none.
 *
 * Re-running otherwise would append a second copy of every photograph:
 * Shopify has no atomic "replace media" mutation, and it does not deduplicate
 * by source URL. `--retry-media` is the deliberate, destructive path for
 * rebuilding a gallery that came out wrong.
 */
async function addMedia(
  env: ShopifyEnv,
  product: ShopifyProduct,
  target: ExistingProduct,
): Promise<void> {
  if (target.mediaCount > 0 || product.images.length === 0) return;

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
    { productId: target.id, media: mediaInput(product) },
  );
  assertNoUserErrors(
    `productCreateMedia(${product.handle})`,
    media.productCreateMedia.mediaUserErrors,
  );
}

/**
 * Archives products the range change withdrew.
 *
 * Archived rather than deleted: an archived product keeps its history, so any
 * order that already references it still renders, and the decision is
 * reversible by a human in admin who disagrees with it. Deletion is not.
 */
async function retireWithdrawn(env: ShopifyEnv): Promise<void> {
  console.log(`Archiving ${RETIRED_HANDLES.length} withdrawn product(s).\n`);

  let archived = 0;
  let absent = 0;
  const failures: string[] = [];

  for (const [index, handle] of RETIRED_HANDLES.entries()) {
    const position = `[${index + 1}/${RETIRED_HANDLES.length}]`;
    try {
      const existing = await findByHandle(env, handle);
      if (!existing) {
        absent += 1;
        console.log(`${position} absent   ${handle}`);
        continue;
      }

      const data = await shopifyGraphql<{
        productUpdate: {
          userErrors: { field?: string[] | null; message: string }[];
        };
      }>(
        env,
        `mutation Archive($product: ProductUpdateInput!) {
           productUpdate(product: $product) { userErrors { field message } }
         }`,
        { product: { id: existing.id, status: "ARCHIVED" } },
      );
      assertNoUserErrors(`productUpdate(${handle})`, data.productUpdate.userErrors);

      archived += 1;
      console.log(`${position} archived ${handle}`);
    } catch (error) {
      failures.push(`${handle}: ${(error as Error).message}`);
      console.log(`${position} FAILED   ${handle}`);
    }
  }

  console.log(
    `\narchived ${archived}, already absent ${absent}, failed ${failures.length}`,
  );
  if (failures.length) {
    console.log(`\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  }
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
/**
 * Rebuilds product galleries in Shopify.
 *
 * Two reasons to need this.
 *
 * The first is failed downloads. Our origin is shared hosting and Shopify's
 * fetcher gives up on slow responses -- the observed failures were "timeout
 * reached" plus one truncated file reported as corrupt, on images that all
 * decode cleanly locally and serve 200 on request. Those are transient and
 * worth retrying.
 *
 * The second is a photography change. Shopify re-hosts every image it
 * fetches, so replacing the photographs on our origin does not touch what the
 * shop serves: it keeps showing the old set from its own CDN indefinitely.
 * That matters because the cart drawer and the checkout line item both take
 * their image from Shopify, so a product page showing the new photography
 * would hand the buyer a basket showing the old. `--replace-media` is the
 * deliberate, destructive answer to that, and it is opt-in because it throws
 * away work Shopify did and makes it fetch every file again.
 *
 * The whole gallery is replaced rather than the individual entries, because
 * deleting one image and appending a replacement would reorder the rest, and
 * position 1 is the product's face: the collection thumbnail, the checkout
 * line-item image and the social card.
 */
async function rebuildGalleries(
  env: ShopifyEnv,
  catalog: ShopifyProduct[],
  everything: boolean,
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
      (everything || p.media.nodes.some((m) => m.status === "FAILED")),
  );

  if (damaged.length === 0) {
    console.log(
      everything
        ? "No products in Shopify to rebuild."
        : "No failed media to retry.",
    );
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

  if (RETRY_MEDIA || REPLACE_MEDIA) {
    const everything = REPLACE_MEDIA;
    if (!LIVE) {
      console.log(
        everything
          ? `--replace-media deletes and re-fetches every photograph on all ${catalog.length} product(s).\n` +
              "Shopify re-hosts images, so it keeps serving the old photography until this is run.\n" +
              "Add --live to apply."
          : "--retry-media rewrites product galleries. Add --live to apply.",
      );
      return;
    }
    const env = loadEnv();
    console.log(
      everything
        ? `Replacing every gallery on ${env.domain}\n`
        : `Retrying failed media on ${env.domain}\n`,
    );
    await rebuildGalleries(env, buildCatalog(), everything);
    return;
  }

  if (RETIRE) {
    if (!LIVE) {
      console.log(
        `DRY RUN -- these ${RETIRED_HANDLES.length} product(s) would be archived:\n`,
      );
      for (const handle of RETIRED_HANDLES) console.log(`  ${handle}`);
      console.log("\nAdd --live to apply.");
      return;
    }
    const env = loadEnv();
    console.log(`Archiving withdrawn products on ${env.domain}\n`);
    await retireWithdrawn(env);
    return;
  }

  if (!LIVE) {
    console.log("DRY RUN -- nothing will be written. Add --live to apply.\n");
    for (const product of catalog) {
      const renamed = product.previousHandle
        ? `\n    rename ${product.previousHandle} -> ${product.handle}`
        : "";
      console.log(
        `  ${product.handle}${renamed}\n` +
          `    title  ${product.title}\n` +
          `    type   ${product.productType}   tags: ${product.tags.join(", ")}\n` +
          product.variants
            .map((v) => `    sku    ${v.sku}   ${v.colour}   ${v.price}`)
            .join("\n") +
          `\n    status ${PUBLISH ? "ACTIVE" : "DRAFT"}   images: ${product.images.length}\n` +
          `    image1 ${product.images[0]?.src ?? "(none)"}`,
      );
    }
    const variantCount = catalog.reduce((n, p) => n + p.variants.length, 0);
    console.log(
      `\n${catalog.length} product(s), ${variantCount} variant(s) would be synced.\n` +
        "Verify the store first:  npm run shopify:preflight\n" +
        "Then try one for real:   npm run shopify:sync -- --live --limit 1\n" +
        `Withdrawn products are archived separately: npm run shopify:sync -- --live --retire`,
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
  let renamed = 0;
  const failures: string[] = [];

  for (const [index, product] of catalog.entries()) {
    const position = `[${index + 1}/${catalog.length}]`;
    try {
      const result = await upsertProduct(env, product);

      if (result.created) {
        created += 1;
        console.log(`${position} created  ${product.handle}`);
      } else if (result.renamedFrom) {
        renamed += 1;
        updated += 1;
        console.log(
          `${position} renamed  ${result.renamedFrom} -> ${product.handle}`,
        );
      } else {
        updated += 1;
        console.log(`${position} updated  ${product.handle}`);
      }

      await addMedia(env, product, result.target);

      if (publicationId) {
        await publishToOnlineStore(env, result.target.id, publicationId);
      }
    } catch (error) {
      /* One bad product must not abandon the other 25. The run is idempotent,
       * so the fix is to correct the cause and run it again. */
      failures.push(`${product.handle}: ${(error as Error).message}`);
      console.log(`${position} FAILED   ${product.handle}`);
    }
  }

  console.log(
    `\ncreated ${created}, updated ${updated} (${renamed} renamed), failed ${failures.length}`,
  );
  if (failures.length) {
    console.log(`\nFailures:\n  ${failures.join("\n  ")}`);
    console.log("\nSync is idempotent -- fix the cause and run it again.");
    process.exitCode = 1;
    return;
  }
  console.log(
    PUBLISH
      ? "\nProducts are ACTIVE and published to the Online Store.\n" +
          "Replace the old photography: npm run shopify:sync -- --live --replace-media\n" +
          "Archive the withdrawn ones:  npm run shopify:sync -- --live --retire\n" +
          "Then regenerate variant ids: npm run shopify:variant-ids\n" +
          "Verify with `npm run shopify:audit`."
      : "\nProducts are DRAFT. Review them in Shopify admin, then re-run with --publish.",
  );
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}`);
  process.exitCode = 1;
});
