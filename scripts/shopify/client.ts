/**
 * Minimal Shopify Admin GraphQL client.
 *
 * Dependency-free on purpose: these credentials can read orders and customer
 * PII and delete the catalog, so the code handling them should be small enough
 * to read in one sitting rather than a supply chain to audit.
 *
 * Authentication uses the **client credentials grant**, which is how apps
 * created in Shopify's Dev Dashboard work from January 2026 onward. There is no
 * long-lived `shpat_` token to copy out of the admin any more; instead the app
 * exchanges its client ID and secret for a token that expires after 24 hours.
 * That is a genuine security improvement -- a leaked token dies by tomorrow --
 * but it does move the thing worth protecting to the secret.
 *
 * Legacy custom apps created before January 2026 still have a `shpat_` token,
 * so that path is kept working too.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* Shopify ships a new API version quarterly and supports each for a year.
 * Pinning matters: an unpinned client changes behaviour underneath you.
 * `preflight` checks this against what the store actually supports and names
 * the newest one when this has aged out, which it will. */
const DEFAULT_API_VERSION = "2026-07";

type Auth =
  | { kind: "client_credentials"; clientId: string; clientSecret: string }
  | { kind: "token"; token: string };

export type ShopifyEnv = {
  domain: string;
  apiVersion: string;
  auth: Auth;
};

/**
 * Reads `.env` by hand rather than pulling in dotenv. Handles the three things
 * that actually appear in a hand-written env file: comments, `export` prefixes
 * and quoted values.
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

const SETUP_HELP = `
Create a file called \`.env\` in the repo root (it is gitignored) containing:

  SHOPIFY_STORE_DOMAIN=theheavencraft.myshopify.com
  SHOPIFY_CLIENT_ID=<Client ID>
  SHOPIFY_CLIENT_SECRET=<Secret>

Both values are in the Dev Dashboard under your app -> App settings -> Credentials.
Unlike the Client ID, the Secret can mint tokens for your store, so treat it like
a password: never paste it into chat, a commit, or a command line.
`.trim();

export function loadEnv(): ShopifyEnv {
  const fromFile = readEnvFile(resolve(process.cwd(), ".env"));
  const get = (key: string): string | undefined => {
    const value = process.env[key] ?? fromFile[key];
    return value && value.trim() ? value.trim() : undefined;
  };

  const rawDomain = get("SHOPIFY_STORE_DOMAIN") ?? get("SHOPIFY_SHOP");
  if (!rawDomain) {
    throw new Error(`Missing SHOPIFY_STORE_DOMAIN.\n\n${SETUP_HELP}`);
  }

  /* Shopify's own example uses the bare subdomain while their help pages use
   * the full host. Accept either rather than making the user care. */
  const domain = `${rawDomain
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\.myshopify\.com$/i, "")
    .toLowerCase()}.myshopify.com`;

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
    throw new Error(
      `SHOPIFY_STORE_DOMAIN should be your permanent myshopify.com store, got "${rawDomain}".\n` +
        "Use the one under Settings -> Domains, not your custom domain -- the\n" +
        "Admin API only answers on the myshopify.com host.",
    );
  }

  const clientId = get("SHOPIFY_CLIENT_ID");
  const clientSecret = get("SHOPIFY_CLIENT_SECRET");
  const legacyToken = get("SHOPIFY_ADMIN_TOKEN");

  let auth: Auth;
  if (clientId && clientSecret) {
    auth = { kind: "client_credentials", clientId, clientSecret };
  } else if (clientId && !clientSecret) {
    /* The common half-finished state: the ID is easy to copy, the Secret is
     * behind a reveal button and is easy to miss. */
    throw new Error(
      "SHOPIFY_CLIENT_ID is set but SHOPIFY_CLIENT_SECRET is empty.\n\n" +
        "In the Dev Dashboard -> your app -> App settings -> Credentials, click the\n" +
        "eye icon next to Secret to reveal it, then paste it into .env.",
    );
  } else if (legacyToken) {
    /* Pre-2026 custom apps still issue a long-lived shpat_ token. */
    if (!/^shpat_[0-9a-f]{32}$/.test(legacyToken)) {
      throw new Error(
        "SHOPIFY_ADMIN_TOKEN is set but does not look like a legacy Admin API token\n" +
          "(expected `shpat_` followed by 32 hex characters).\n\n" +
          "Apps created in the Dev Dashboard do not have one at all. Use the client\n" +
          `credentials instead:\n\n${SETUP_HELP}`,
      );
    }
    auth = { kind: "token", token: legacyToken };
  } else {
    throw new Error(`Missing Shopify credentials.\n\n${SETUP_HELP}`);
  }

  return {
    domain,
    apiVersion: get("SHOPIFY_API_VERSION") ?? DEFAULT_API_VERSION,
    auth,
  };
}

/** Scopes reported back by the token endpoint on the most recent mint. */
let grantedScopes: string[] = [];
export const lastGrantedScopes = (): string[] => grantedScopes;

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Minted tokens last 24 hours. Cached in memory only -- writing one to disk
 * would turn a deliberately short-lived credential back into a long-lived one
 * sitting in a file, which is the problem this grant type exists to solve.
 */
export async function getAccessToken(env: ShopifyEnv): Promise<string> {
  if (env.auth.kind === "token") return env.auth.token;

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

  const response = await fetch(
    `https://${env.domain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.auth.clientId,
        client_secret: env.auth.clientSecret,
      }),
    },
  );

  const body = await response.text();

  if (!response.ok) {
    /* The two failures that actually happen, which look identical from the
     * status code alone. */
    if (body.includes("shop_not_permitted")) {
      throw new Error(
        "Shopify says: shop_not_permitted.\n\n" +
          "This grant only works when the app and the store are in the SAME Shopify\n" +
          "organization. Owning the store is not enough.\n\n" +
          "Check in the Dev Dashboard (dev.shopify.com/dashboard):\n" +
          "  - your app is listed under Apps\n" +
          `  - "${env.domain.replace(".myshopify.com", "")}" is listed under Stores\n` +
          "  - both sit under the same org id in the dashboard URL\n\n" +
          "Also confirm the app is actually INSTALLED on the store.",
      );
    }
    if (response.status === 401 || body.includes("invalid_client")) {
      throw new Error(
        "Shopify rejected the client credentials.\n\n" +
          "Re-copy SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET from the Dev Dashboard\n" +
          "(App settings -> Credentials). If the secret was rotated, the previous one\n" +
          "stopped working immediately.",
      );
    }
    throw new Error(
      `Token request failed (HTTP ${response.status}): ${body.slice(0, 300)}`,
    );
  }

  const parsed = JSON.parse(body) as {
    access_token: string;
    scope?: string;
    expires_in: number;
  };

  /* The token request does not ask for scopes -- this is a readback of what
   * was selected on the app version, which makes it a free scope check. */
  grantedScopes = parsed.scope ? parsed.scope.split(",").filter(Boolean) : [];
  cachedToken = {
    value: parsed.access_token,
    expiresAt: Date.now() + parsed.expires_in * 1000,
  };
  return cachedToken.value;
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
 * One GraphQL round trip, with the retries that matter: `THROTTLED` (Shopify's
 * leaky bucket ran dry), 5xx, and an expired minted token.
 *
 * Shopify answers 200 OK for GraphQL-level errors, so the status code alone
 * never tells you whether a call actually worked.
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
        "X-Shopify-Access-Token": await getAccessToken(env),
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  if (response.status === 401 || response.status === 403) {
    /* A minted token lasts 24h and a full sync is far shorter than that, but
     * an interrupted session can straddle the boundary. Drop it and retry once
     * before concluding the credentials are wrong. */
    if (attempt === 1 && env.auth.kind === "client_credentials") {
      cachedToken = null;
      return shopifyGraphql<T>(env, query, variables, attempt + 1);
    }
    throw new Error(
      `Shopify rejected the token (HTTP ${response.status}).\n` +
        "Most likely a missing scope. Run `npm run shopify:preflight` for details.",
    );
  }

  if (response.status === 404) {
    throw new Error(
      `Shopify returned 404 for API version "${env.apiVersion}".\n` +
        "That version has probably been retired. Run `npm run shopify:preflight`\n" +
        "to see which versions this store supports.",
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
      `Shopify returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }

  const body = (await response.json()) as GraphqlResponse<T>;

  if (body.errors?.some((error) => error.extensions?.code === "THROTTLED")) {
    if (attempt > 5) throw new Error("Shopify throttled 5 attempts in a row.");
    /* Wait for the bucket to refill enough for this query rather than guessing;
     * restoreRate is points per second. */
    const cost = body.extensions?.cost;
    const waitMs = cost
      ? Math.max(
          1000,
          ((cost.requestedQueryCost - cost.throttleStatus.currentlyAvailable) /
            cost.throttleStatus.restoreRate) *
            1000,
        )
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

/** The scopes this project needs, and nothing more. */
export const REQUIRED_SCOPES = ["read_products", "write_products"] as const;
