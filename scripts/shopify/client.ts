/**
 * Minimal Shopify Admin GraphQL client.
 *
 * Deliberately dependency-free: the token is the most dangerous secret in this
 * repo -- it can read orders and customer PII and delete the catalog -- so the
 * code that handles it is small enough to read in one sitting rather than a
 * supply chain to audit.
 *
 * The token is read from a gitignored `.env`, is never printed, and is never
 * passed as a CLI argument (argv shows up in shell history and process lists).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* Shopify ships a new API version each quarter and supports each for a year.
 * Pinning matters: an unpinned client silently changes behaviour underneath
 * you. `preflight` verifies this value against what the store actually
 * supports and names the newest one if this has aged out. */
const DEFAULT_API_VERSION = "2025-01";

export type ShopifyEnv = {
  domain: string;
  token: string;
  apiVersion: string;
};

/**
 * Reads `.env` by hand rather than pulling in dotenv. Handles the three things
 * that actually show up in a hand-written env file: comments, `export `
 * prefixes and quoted values.
 */
function readEnvFile(path: string): Record<string, string> {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return {};
  }

  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(
      trimmed,
    );
    if (!match) continue;

    const key = match[1]!;
    let value = match[2]!.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** A token pasted with the `shpat_` prefix mangled is the usual first failure. */
function assertTokenShape(token: string): void {
  if (!/^shpat_[0-9a-f]{32}$/.test(token)) {
    throw new Error(
      "SHOPIFY_ADMIN_TOKEN does not look like an Admin API access token.\n" +
        "Expected `shpat_` followed by 32 hex characters.\n" +
        "In Shopify admin: Settings -> Apps and sales channels -> Develop apps\n" +
        "-> your app -> API credentials -> Admin API access token.\n" +
        "Note it is shown exactly once; if you missed it, uninstall and reinstall the app.",
    );
  }
}

export function loadEnv(): ShopifyEnv {
  const fromFile = readEnvFile(resolve(process.cwd(), ".env"));
  const get = (key: string): string | undefined =>
    process.env[key] ?? fromFile[key];

  const domain = get("SHOPIFY_STORE_DOMAIN");
  const token = get("SHOPIFY_ADMIN_TOKEN");

  if (!domain || !token) {
    throw new Error(
      "Missing Shopify credentials.\n\n" +
        "Create a file called `.env` in the repo root (it is gitignored) containing:\n\n" +
        "  SHOPIFY_STORE_DOMAIN=your-store.myshopify.com\n" +
        "  SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n\n" +
        "Do not paste the token into chat, a commit, or a command line.",
    );
  }

  const normalisedDomain = domain
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  if (!/^[a-z0-9-]+\.myshopify\.com$/i.test(normalisedDomain)) {
    throw new Error(
      `SHOPIFY_STORE_DOMAIN should be the permanent .myshopify.com domain, got "${normalisedDomain}".\n` +
        "Use the one under Settings -> Domains, not your custom domain -- the\n" +
        "Admin API only answers on the myshopify.com host.",
    );
  }

  assertTokenShape(token.trim());

  return {
    domain: normalisedDomain,
    token: token.trim(),
    apiVersion: get("SHOPIFY_API_VERSION")?.trim() || DEFAULT_API_VERSION,
  };
}

type GraphqlResponse<T> = {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      throttleStatus: {
        currentlyAvailable: number;
        maximumAvailable: number;
        restoreRate: number;
      };
    };
  };
};

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

/**
 * One GraphQL round trip, with the two retries that actually matter:
 * `THROTTLED` (Shopify's leaky bucket ran dry) and 5xx.
 *
 * Shopify answers 200 OK for GraphQL-level errors, so the status code alone
 * never tells you whether a call worked.
 */
export async function shopifyGraphql<T>(
  env: ShopifyEnv,
  query: string,
  variables: Record<string, unknown> = {},
  attempt = 1,
): Promise<T> {
  const response = await fetch(
    `https://${env.domain}/admin/api/${env.apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": env.token,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `Shopify rejected the token (HTTP ${response.status}).\n` +
        "Either the token is wrong, or the app is missing a scope.\n" +
        "Run `npm run shopify:preflight` for the specific scope list.",
    );
  }

  if (response.status === 404) {
    throw new Error(
      `Shopify returned 404 for API version "${env.apiVersion}".\n` +
        "That version has probably been retired. Run `npm run shopify:preflight`\n" +
        "to see the versions this store supports.",
    );
  }

  if (response.status === 429 || response.status >= 500) {
    if (attempt > 5) {
      throw new Error(
        `Shopify kept returning HTTP ${response.status} after 5 attempts.`,
      );
    }
    await sleep(attempt * 2000);
    return shopifyGraphql<T>(env, query, variables, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(
      `Shopify returned HTTP ${response.status}: ${await response.text()}`,
    );
  }

  const body = (await response.json()) as GraphqlResponse<T>;

  const throttled = body.errors?.some(
    (error) => error.extensions?.code === "THROTTLED",
  );
  if (throttled) {
    if (attempt > 5) throw new Error("Shopify throttled 5 attempts in a row.");
    /* Wait for the bucket to refill enough for this query rather than a flat
     * guess -- restoreRate is points per second. */
    const cost = body.extensions?.cost;
    const deficit = cost
      ? cost.requestedQueryCost - cost.throttleStatus.currentlyAvailable
      : 0;
    const waitMs = cost
      ? Math.max(1000, (deficit / cost.throttleStatus.restoreRate) * 1000)
      : attempt * 2000;
    await sleep(waitMs);
    return shopifyGraphql<T>(env, query, variables, attempt + 1);
  }

  if (body.errors?.length) {
    throw new Error(
      `Shopify GraphQL error:\n  ${body.errors.map((e) => e.message).join("\n  ")}`,
    );
  }

  if (!body.data) throw new Error("Shopify returned no data.");
  return body.data;
}

/** Mutations answer 200 with a userErrors array; ignoring it loses failures. */
export function assertNoUserErrors(
  label: string,
  userErrors: { field?: string[] | null; message: string }[] | undefined,
): void {
  if (!userErrors?.length) return;
  const detail = userErrors
    .map((e) => `${e.field?.join(".") ?? "-"}: ${e.message}`)
    .join("\n  ");
  throw new Error(`${label} failed:\n  ${detail}`);
}

/** The scopes this project needs, and why. */
export const REQUIRED_SCOPES = [
  "read_products",
  "write_products",
] as const;
