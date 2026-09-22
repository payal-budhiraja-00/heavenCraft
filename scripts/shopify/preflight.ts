/**
 * Read-only Shopify readiness check. Creates, updates and deletes nothing.
 *
 * Every check here corresponds to a way an import can appear to succeed and
 * still be wrong: a store in the wrong currency turns 13999 rupees into
 * 13999 dollars, a missing scope fails halfway through leaving a partial
 * catalog, an unreachable image yields a product with no photo.
 *
 *   npm run shopify:preflight
 */

import {
  REQUIRED_SCOPES,
  loadEnv,
  shopifyGraphql,
  type ShopifyEnv,
} from "./client";
import { allImageUrls, buildCatalog } from "./payload";

type Check = { ok: boolean; label: string; detail: string };

const results: Check[] = [];
const record = (ok: boolean, label: string, detail: string): void => {
  results.push({ ok, label, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}\n         ${detail}`);
};

/**
 * `api_versions.json` is the one Admin endpoint that needs no version in its
 * path, which makes it the only safe thing to call when the pinned version is
 * the thing under suspicion.
 */
async function checkApiVersion(env: ShopifyEnv): Promise<void> {
  const response = await fetch(
    `https://${env.domain}/admin/api/api_versions.json`,
    { headers: { "X-Shopify-Access-Token": env.token } },
  );

  if (!response.ok) {
    record(
      false,
      "API version",
      `could not list supported versions (HTTP ${response.status}). ` +
        "If this is 401 the token is wrong or was revoked.",
    );
    return;
  }

  const body = (await response.json()) as {
    api_versions: { handle: string; supported: boolean }[];
  };
  const supported = body.api_versions
    .filter((v) => v.supported)
    .map((v) => v.handle)
    .sort();
  const newest = supported[supported.length - 1] ?? "unknown";

  if (supported.includes(env.apiVersion)) {
    record(
      true,
      "API version",
      `${env.apiVersion} is supported (newest stable is ${newest})`,
    );
  } else {
    record(
      false,
      "API version",
      `${env.apiVersion} is NOT supported. Set SHOPIFY_API_VERSION=${newest} in .env. ` +
        `Supported: ${supported.join(", ")}`,
    );
  }
}

async function checkShop(env: ShopifyEnv): Promise<void> {
  const data = await shopifyGraphql<{
    shop: {
      name: string;
      myshopifyDomain: string;
      currencyCode: string;
      primaryDomain: { url: string };
    };
  }>(
    env,
    `{ shop { name myshopifyDomain currencyCode primaryDomain { url } } }`,
  );

  const shop = data.shop;
  record(
    true,
    "Connectivity",
    `connected to "${shop.name}" (${shop.myshopifyDomain})`,
  );

  /* The single most expensive thing to get wrong. Our prices are plain rupee
   * numbers with no currency attached, so the store's currency decides what
   * they mean. Fixing this after an import means re-pricing 34 products. */
  record(
    shop.currencyCode === "INR",
    "Store currency",
    shop.currencyCode === "INR"
      ? "INR -- prices from the catalog will import as rupees"
      : `store is set to ${shop.currencyCode}, but our prices are in RUPEES. ` +
          "Change it in Settings -> General -> Store currency BEFORE importing.",
  );
}

async function checkScopes(env: ShopifyEnv): Promise<void> {
  const data = await shopifyGraphql<{
    currentAppInstallation: { accessScopes: { handle: string }[] };
  }>(env, `{ currentAppInstallation { accessScopes { handle } } }`);

  const granted = new Set(
    data.currentAppInstallation.accessScopes.map((s) => s.handle),
  );
  const missing = REQUIRED_SCOPES.filter((scope) => !granted.has(scope));

  record(
    missing.length === 0,
    "API scopes",
    missing.length === 0
      ? `granted: ${REQUIRED_SCOPES.join(", ")}`
      : `missing ${missing.join(", ")}. Add them under Configuration -> ` +
          "Admin API integration in your custom app, then click Save and Install.",
  );

  /* Not required, but worth knowing: a token with order or customer scopes is
   * far more dangerous to leak than one that can only touch products. */
  const sensitive = [...granted].filter((s) => /customer|order|draft/.test(s));
  if (sensitive.length) {
    record(
      true,
      "Token blast radius",
      `NOTE: this token also holds ${sensitive.join(", ")}. It only needs ` +
        "product scopes -- consider removing the rest.",
    );
  }
}

/**
 * A handle that already exists is not automatically a problem -- sync updates
 * in place by design -- but it must be a deliberate choice rather than a
 * surprise, especially on a store that already has demo products.
 */
async function checkExistingProducts(env: ShopifyEnv): Promise<void> {
  const data = await shopifyGraphql<{
    products: { nodes: { handle: string; title: string }[] };
    productsCount: { count: number };
  }>(
    env,
    `{
       products(first: 250) { nodes { handle title } }
       productsCount { count }
     }`,
  );

  const existing = new Set(data.products.nodes.map((p) => p.handle));
  const ours = buildCatalog();
  const overlap = ours.filter((p) => existing.has(p.handle));

  record(
    true,
    "Existing products",
    `store currently holds ${data.productsCount.count} product(s); ` +
      `${overlap.length} of our ${ours.length} handles already exist` +
      (overlap.length
        ? ` and would be UPDATED: ${overlap
            .slice(0, 5)
            .map((p) => p.handle)
            .join(", ")}${overlap.length > 5 ? ", ..." : ""}`
        : " -- all would be created fresh"),
  );
}

/**
 * Shopify fetches each image from our server and re-hosts it. A 404 here does
 * not fail the import; it just produces a product with no photograph, which is
 * far harder to notice afterwards.
 */
async function checkImages(): Promise<void> {
  const urls = allImageUrls(buildCatalog());
  const broken: string[] = [];

  const queue = [...urls];
  const workers = Array.from({ length: 8 }, async () => {
    for (;;) {
      const url = queue.pop();
      if (!url) return;
      try {
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) broken.push(`${response.status} ${url}`);
      } catch (error) {
        broken.push(`ERR ${url} (${(error as Error).message})`);
      }
    }
  });
  await Promise.all(workers);

  record(
    broken.length === 0,
    "Image reachability",
    broken.length === 0
      ? `all ${urls.length} image URLs return 200`
      : `${broken.length} of ${urls.length} unreachable:\n         ${broken.slice(0, 5).join("\n         ")}`,
  );
}

async function main(): Promise<void> {
  console.log("Shopify preflight -- read only, nothing will be created.\n");

  const env = loadEnv();
  console.log(`  store   ${env.domain}`);
  console.log(`  version ${env.apiVersion}\n`);

  await checkApiVersion(env);
  await checkShop(env);
  await checkScopes(env);
  await checkExistingProducts(env);
  await checkImages();

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed.`,
  );

  if (failed.length) {
    console.log("\nFix the FAIL lines above before running shopify:sync.");
    process.exitCode = 1;
    return;
  }
  console.log("Ready. Next: npm run shopify:sync  (dry run by default)");
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}`);
  process.exitCode = 1;
});
