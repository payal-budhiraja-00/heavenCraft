/**
 * Read-only Shopify readiness check. Creates, updates and deletes nothing.
 *
 * Every check here corresponds to a way an import can appear to succeed and
 * still be wrong: a store in the wrong currency turns 13999 rupees into 13999
 * dollars, a missing scope fails halfway leaving a partial catalog, an
 * unreachable image yields a product with no photograph.
 *
 *   npm run shopify:preflight
 */

import {
  REQUIRED_SCOPES,
  getAccessToken,
  lastGrantedScopes,
  loadEnv,
  shopifyGraphql,
  type ShopifyEnv,
} from "./client";
import { allImageUrls, buildCatalog } from "./payload";

type Check = { ok: boolean; label: string };

const results: Check[] = [];
const record = (ok: boolean, label: string, detail: string): void => {
  results.push({ ok, label });
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}\n         ${detail}`);
};

/**
 * Minting a token is the first thing that can fail and the thing every later
 * check depends on, so it gets its own step -- otherwise a bad secret shows up
 * as a confusing "API version" failure.
 */
async function checkAuth(env: ShopifyEnv): Promise<boolean> {
  try {
    await getAccessToken(env);
  } catch (error) {
    record(false, "Authentication", (error as Error).message);
    return false;
  }

  record(
    true,
    "Authentication",
    env.auth.kind === "client_credentials"
      ? "minted a 24-hour access token from the client credentials"
      : "using a legacy shpat_ token",
  );
  return true;
}

/**
 * For client credentials the token response reads back the scopes selected on
 * the app version, so this costs nothing. Legacy tokens need the API.
 */
async function checkScopes(env: ShopifyEnv): Promise<void> {
  let granted = lastGrantedScopes();

  if (env.auth.kind === "token") {
    const data = await shopifyGraphql<{
      currentAppInstallation: { accessScopes: { handle: string }[] };
    }>(env, `{ currentAppInstallation { accessScopes { handle } } }`);
    granted = data.currentAppInstallation.accessScopes.map((s) => s.handle);
  }

  /* Shopify's write scopes subsume their read counterpart -- a store granting
   * `write_products` never separately lists `read_products`, and demanding both
   * would report a healthy app as broken. */
  const covered = (needed: string): boolean =>
    granted.includes(needed) ||
    (needed.startsWith("read_") &&
      granted.includes(`write_${needed.slice("read_".length)}`));

  const missing = REQUIRED_SCOPES.filter((scope) => !covered(scope));

  record(
    missing.length === 0,
    "API scopes",
    missing.length === 0
      ? `granted: ${granted.join(", ")}`
      : `missing ${missing.join(", ")} (granted: ${granted.join(", ") || "none"}).\n` +
          "         In the Dev Dashboard: your app -> Versions -> create a new version\n" +
          "         with these scopes under Access, Release it, then approve the change\n" +
          "         on the store. Scopes are fixed per version, so editing needs a release.",
  );

  /* Not required, but worth surfacing: a token that can read orders or
   * customers is far more dangerous to leak than one limited to products. */
  const sensitive = granted.filter((s) => /customer|order|draft/.test(s));
  if (sensitive.length) {
    record(
      true,
      "Token blast radius",
      `NOTE: also granted ${sensitive.join(", ")}. This project only needs ` +
        "product scopes -- consider dropping the rest in the next version.",
    );
  }
}

/**
 * Asked over GraphQL rather than the REST `api_versions.json` endpoint, which
 * is retired on stores created today and answers 404.
 */
async function checkApiVersion(env: ShopifyEnv): Promise<void> {
  const data = await shopifyGraphql<{
    publicApiVersions: { handle: string; supported: boolean }[];
  }>(env, `{ publicApiVersions { handle supported } }`);

  const supported = data.publicApiVersions
    .filter((v) => v.supported && /^\d{4}-\d{2}$/.test(v.handle))
    .map((v) => v.handle)
    .sort();
  const newest = supported[supported.length - 1] ?? "unknown";

  record(
    supported.includes(env.apiVersion),
    "API version",
    supported.includes(env.apiVersion)
      ? `${env.apiVersion} is supported (newest stable is ${newest})`
      : `${env.apiVersion} is NOT supported. Set SHOPIFY_API_VERSION=${newest} in .env.\n` +
          `         Supported: ${supported.join(", ")}`,
  );
}

async function checkShop(env: ShopifyEnv): Promise<void> {
  const data = await shopifyGraphql<{
    shop: { name: string; myshopifyDomain: string; currencyCode: string };
  }>(env, `{ shop { name myshopifyDomain currencyCode } }`);

  const shop = data.shop;
  /* The permanent myshopifyDomain often differs from the vanity domain used to
   * log in, which makes a correct connection look like the wrong store. */
  const alias =
    shop.myshopifyDomain.toLowerCase() === env.domain.toLowerCase()
      ? ""
      : ` -- reached via ${env.domain}, which is an alias for the same shop`;

  record(
    true,
    "Connectivity",
    `connected to "${shop.name}" (${shop.myshopifyDomain})${alias}`,
  );

  /* The most expensive thing to get wrong. Our prices are bare rupee numbers
   * with no currency attached, so the store's currency decides what they mean.
   * Fixing it afterwards means re-pricing all 34 products. */
  record(
    shop.currencyCode === "INR",
    "Store currency",
    shop.currencyCode === "INR"
      ? "INR -- catalog prices will import as rupees"
      : `store is set to ${shop.currencyCode}, but our prices are in RUPEES.\n` +
          "         Change it in Settings -> General -> Store currency BEFORE importing.",
  );
}

/**
 * An existing handle is not automatically a problem -- sync updates in place
 * by design -- but it should be a deliberate choice rather than a surprise.
 */
async function checkExistingProducts(env: ShopifyEnv): Promise<void> {
  const data = await shopifyGraphql<{
    products: { nodes: { handle: string }[] };
    productsCount: { count: number };
  }>(
    env,
    `{
       products(first: 250) { nodes { handle } }
       productsCount { count }
     }`,
  );

  const existing = new Set(data.products.nodes.map((p) => p.handle));
  const ours = buildCatalog();
  const overlap = ours.filter((p) => existing.has(p.handle));

  record(
    true,
    "Existing products",
    `store holds ${data.productsCount.count} product(s); ` +
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
 * Shopify fetches each image from our server and re-hosts it. A 404 does not
 * fail the import; it just produces a product with no photograph, which is far
 * harder to notice afterwards.
 */
async function checkImages(): Promise<void> {
  const urls = allImageUrls(buildCatalog());
  const broken: string[] = [];

  const queue = [...urls];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (;;) {
        const url = queue.pop();
        if (!url) return;
        try {
          const response = await fetch(url);
          if (!response.ok) broken.push(`${response.status} ${url}`);
        } catch (error) {
          broken.push(`ERR ${url} (${(error as Error).message})`);
        }
      }
    }),
  );

  record(
    broken.length === 0,
    "Image reachability",
    broken.length === 0
      ? `all ${urls.length} image URLs return 200`
      : `${broken.length} of ${urls.length} unreachable:\n         ${broken.slice(0, 5).join("\n         ")}`,
  );
}

/**
 * Shopify sits behind Cloudflare, so `server: cloudflare` says nothing about
 * who serves a host. `powered-by: Shopify` is the honest signal.
 */
async function servedByShopify(host: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${host}/`, { redirect: "manual" });
    return /shopify/i.test(response.headers.get("powered-by") ?? "");
  } catch {
    return false;
  }
}

/**
 * Where "Pay now" actually lands.
 *
 * The Storefront API builds `cart.checkoutUrl` on the store's PRIMARY domain,
 * not on myshopifyDomain. When the marketing site and the store share a root
 * domain it is easy to make the marketing domain primary, and then checkout
 * redirects to a host Shopify does not serve. Nothing before the payment step
 * looks wrong, which is what makes it worth checking every run.
 */
async function checkCheckoutDomain(env: ShopifyEnv): Promise<void> {
  const data = await shopifyGraphql<{
    shop: { primaryDomain: { host: string } };
  }>(env, `{ shop { primaryDomain { host } } }`);

  const host = data.shop.primaryDomain.host;

  if (host.toLowerCase().endsWith(".myshopify.com")) {
    record(
      true,
      "Checkout domain",
      `${host} -- Shopify serves this itself, so checkout resolves`,
    );
    return;
  }

  const ok = await servedByShopify(host);
  record(
    ok,
    "Checkout domain",
    ok
      ? `${host} is served by Shopify -- checkout will resolve`
      : `${host} is the primary domain, so cart.checkoutUrl points there, but it\n` +
          "         is not served by Shopify and checkout would 404.\n" +
          "         Add a subdomain as CNAME -> shops.myshopify.com (DNS-only, NOT\n" +
          "         proxied, if Cloudflare fronts the zone), then make it primary\n" +
          "         in Shopify Settings -> Domains.",
  );
}

async function main(): Promise<void> {
  console.log("Shopify preflight -- read only, nothing will be created.\n");

  const env = loadEnv();
  console.log(`  store   ${env.domain}`);
  console.log(`  version ${env.apiVersion}`);
  console.log(`  auth    ${env.auth.kind}\n`);

  if (await checkAuth(env)) {
    await checkScopes(env);
    await checkApiVersion(env);
    await checkShop(env);
    await checkCheckoutDomain(env);
    await checkExistingProducts(env);
  }
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
