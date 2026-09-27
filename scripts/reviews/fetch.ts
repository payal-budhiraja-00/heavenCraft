/**
 * Pulls real customer reviews from Judge.me into `src/data/reviews.generated.json`.
 *
 * Why a build-time fetch rather than the Judge.me widget:
 *
 * The widget is a Shopify theme app extension. Our storefront is not a Shopify
 * theme -- it is a static export sitting on GoDaddy -- so the theme embed has
 * nothing to attach to. Their JS-only drop-in would also mean reviews load
 * after paint, arrive as client-rendered text Google is slower to trust, and
 * vanish entirely for anyone whose network eats a third-party script. Baking
 * them into the HTML at build time avoids all three.
 *
 * Run it whenever you want the site to pick up new reviews, then commit the
 * generated file. A deploy without a re-run is not wrong, merely a few reviews
 * behind, which is the failure mode you want from something optional.
 *
 *   npm run reviews:fetch
 *
 * Needs a private API token in `.env`:
 *
 *   JUDGEME_API_TOKEN=<token>
 *
 * Judge.me admin -> Settings -> Integrations. It reads your review data, so
 * treat it like a password: never paste it into chat or a commit.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv, readEnvFile, shopifyGraphql } from "../shopify/client";
import { allProducts } from "../../src/lib/catalog";

const API = "https://api.judge.me/api/v1";
const PER_PAGE = 100;
/** Judge.me will keep serving pages forever if you ask wrong; don't loop. */
const MAX_PAGES = 100;

const OUT = resolve(process.cwd(), "src/data/reviews.generated.json");

const SETUP_HELP = `
Add your Judge.me private token to \`.env\` in the repo root (it is gitignored):

  JUDGEME_API_TOKEN=<token>

Find it in Judge.me admin -> Settings -> Integrations.

You do NOT need the Shopify theme app embed enabled for this. That only powers
the widget inside a Shopify-hosted storefront, and ours is not one.
`.trim();

type Env = { token: string; shopDomain: string };

function normaliseShop(raw: string): string {
  return `${raw
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\.myshopify\.com$/i, "")
    .toLowerCase()}.myshopify.com`;
}

/**
 * Judge.me only answers for a store's *permanent* myshopify domain, and that
 * is very often not the one you'd guess.
 *
 * Shopify hands newer stores a random permanent domain (ours is
 * `3wzikw-0t.myshopify.com`) while still accepting a friendlier alias on the
 * Admin API. So `SHOPIFY_STORE_DOMAIN` can be a name that works everywhere
 * else and fails here, producing a 401 that reads like a bad token and sends
 * you off rotating credentials that were never wrong.
 *
 * Rather than document that trap, ask Shopify which domain is the real one.
 * `JUDGEME_SHOP_DOMAIN` overrides it if you ever need to point elsewhere.
 */
async function resolveShopDomain(
  get: (key: string) => string | undefined,
): Promise<string> {
  const explicit = get("JUDGEME_SHOP_DOMAIN");
  if (explicit) return normaliseShop(explicit);

  try {
    const shopify = loadEnv();
    const data = await shopifyGraphql<{ shop: { myshopifyDomain: string } }>(
      shopify,
      `{ shop { myshopifyDomain } }`,
      {},
    );
    const domain = data.shop.myshopifyDomain?.trim();
    if (domain) return domain.toLowerCase();
  } catch {
    /* No Shopify credentials to hand is not fatal -- fall back to the
     * configured name and let the 401 message explain itself. */
  }

  const fallback = get("SHOPIFY_STORE_DOMAIN") ?? get("SHOPIFY_SHOP");
  if (!fallback) {
    throw new Error(
      "Cannot work out which shop to ask Judge.me about.\n" +
        "Set JUDGEME_SHOP_DOMAIN to your permanent myshopify.com domain.",
    );
  }
  return normaliseShop(fallback);
}

async function loadJudgeEnv(): Promise<Env> {
  const fromFile = readEnvFile(resolve(process.cwd(), ".env"));
  const get = (key: string): string | undefined => {
    const value = process.env[key] ?? fromFile[key];
    return value && value.trim() ? value.trim() : undefined;
  };

  const token = get("JUDGEME_API_TOKEN");
  if (!token) throw new Error(`Missing JUDGEME_API_TOKEN.\n\n${SETUP_HELP}`);

  return { token, shopDomain: await resolveShopDomain(get) };
}

async function getPage(
  env: Env,
  path: string,
  page: number,
): Promise<Record<string, unknown>> {
  const url = new URL(`${API}/${path}`);
  url.searchParams.set("api_token", env.token);
  url.searchParams.set("shop_domain", env.shopDomain);
  url.searchParams.set("per_page", String(PER_PAGE));
  url.searchParams.set("page", String(page));

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    /* 401 here usually means the token is real but belongs to a different
     * shop, so name both things rather than just saying "unauthorized". */
    const hint =
      res.status === 401 || res.status === 403
        ? `\n\nJudge.me does not recognise ${env.shopDomain}.\n` +
          "This is far more often the domain than the token: Judge.me only\n" +
          "answers for a store's permanent myshopify.com domain, which for\n" +
          "newer stores is a random handle rather than your brand name.\n" +
          "Set JUDGEME_SHOP_DOMAIN in .env if the lookup picked the wrong one."
        : "";
    throw new Error(
      `Judge.me ${path} p${page} -> ${res.status}: ${body}${hint}`,
    );
  }
  return (await res.json()) as Record<string, unknown>;
}

async function getAll(
  env: Env,
  path: string,
  key: string,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = await getPage(env, path, page);
    const rows = body[key];
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...(rows as Record<string, unknown>[]));
    if (rows.length < PER_PAGE) break;
  }
  return all;
}

/** Judge.me dates are ISO timestamps; the page only ever shows the day. */
function toDay(value: unknown): string {
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

/**
 * A name we are willing to print. Judge.me lets the reviewer type anything,
 * and an empty one renders as a floating rating with no author, which reads
 * as fabricated even when it isn't.
 */
function toAuthor(row: Record<string, unknown>): string {
  const reviewer = (row.reviewer ?? {}) as Record<string, unknown>;
  const name = String(reviewer.name ?? row.reviewer_name ?? "").trim();
  /* Not "Verified customer": whether Judge.me verified them is a separate
   * field, and a missing name says nothing about it either way. */
  return name || "Customer";
}

/* Judge.me publishes an example value of "buyer" for this field but does not
 * document the full set, and we cannot read the rest off our own data because
 * there are no reviews yet. So both ends are listed explicitly and anything
 * unrecognised is reported rather than guessed at.
 *
 * Unknown means unverified. Getting that wrong in the generous direction
 * prints a badge Judge.me never granted, which is the failure that costs a
 * reader their trust; getting it wrong in this direction only withholds a
 * badge, and the warning below says so out loud so it gets fixed the first
 * time a real review lands. */
const VERIFIED_VALUES = new Set(["buyer", "verified", "true"]);
const UNVERIFIED_VALUES = new Set(["", "web", "unverified", "false", "none"]);
const unknownVerified = new Set<string>();

function toVerified(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (raw == null) return false;

  const value = String(raw).trim().toLowerCase();
  if (VERIFIED_VALUES.has(value)) return true;
  if (UNVERIFIED_VALUES.has(value)) return false;

  unknownVerified.add(value);
  return false;
}

async function main(): Promise<void> {
  const env = await loadJudgeEnv();
  console.log(`Judge.me shop: ${env.shopDomain}`);

  const [products, reviews] = await Promise.all([
    getAll(env, "products", "products"),
    getAll(env, "reviews", "reviews"),
  ]);

  /* Judge.me keys reviews by Shopify's numeric product id, so we need the
   * handle to get back to our slug. They are the same string -- the Shopify
   * sync writes our slug as the handle. */
  const handleOf = new Map<string, string>();
  for (const p of products) {
    const externalId = String(p.external_id ?? p.id ?? "");
    const handle = String(p.handle ?? "").trim();
    if (externalId && handle) handleOf.set(externalId, handle);
  }

  const known = new Set(allProducts.map((p) => p.slug));

  /* Judge.me's public review form takes a Shopify product id as `?id=` and
   * opens straight on that product, skipping the "type the product name"
   * step. The id is the same external_id it keys reviews by, so the map falls
   * out of the lookup above for free.
   *
   * Only products we still sell go in: a link to something withdrawn would
   * open a form for a chair the catalogue no longer has a page for. */
  const productIds: Record<string, string> = {};
  for (const [externalId, handle] of handleOf) {
    if (known.has(handle)) productIds[handle] = externalId;
  }

  const byProduct: Record<string, ReviewRow[]> = {};
  let skipped = 0;
  const unmapped = new Set<string>();

  for (const row of reviews) {
    /* Anything the merchant hid, or Judge.me flagged as spam, has already
     * been judged. Publishing it anyway would make moderation pointless. */
    if (row.hidden === true || row.curated === "spam") {
      skipped++;
      continue;
    }
    if (row.published !== undefined && row.published !== true) {
      skipped++;
      continue;
    }

    const externalId = String(row.product_external_id ?? "");
    const handle = handleOf.get(externalId) ?? String(row.product_handle ?? "");
    if (!handle || !known.has(handle)) {
      unmapped.add(handle || `external_id:${externalId}`);
      continue;
    }

    const body = String(row.body ?? "").trim();
    if (!body) {
      skipped++;
      continue;
    }

    /* A review without a usable 1-5 star rating cannot go into an
     * aggregateRating, and a NaN reaching the markup would invalidate the
     * whole Product node rather than just its own entry. */
    const rating = Number(row.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      skipped++;
      continue;
    }

    (byProduct[handle] ??= []).push({
      id: Number(row.id),
      author: toAuthor(row),
      rating,
      date: toDay(row.created_at),
      title: String(row.title ?? "").trim(),
      comment: body,
      verified: toVerified(row.verified),
    });
  }

  /* Newest first, then by id, so an unchanged set of reviews always writes a
   * byte-identical file and the commit diff means something. */
  const sorted: Record<string, ReviewRow[]> = {};
  for (const slug of Object.keys(byProduct).sort()) {
    const rows = byProduct[slug] ?? [];
    sorted[slug] = rows.sort((a, b) =>
      a.date !== b.date ? b.date.localeCompare(a.date) : b.id - a.id,
    );
  }

  const kept = Object.values(sorted).reduce((n, rows) => n + rows.length, 0);

  /* An empty pull is normal before the first review lands. Reviews existing
   * but none of them mapping is not -- that is a broken handle lookup
   * quietly emptying the site, so refuse to write it. */
  if (reviews.length > 0 && kept === 0 && skipped < reviews.length) {
    throw new Error(
      `Judge.me returned ${reviews.length} review(s) but none matched a product.\n` +
        `Unmatched: ${[...unmapped].slice(0, 10).join(", ")}\n` +
        "The handle lookup is wrong; refusing to overwrite with an empty file.",
    );
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    source: "judge.me",
    productIds: Object.fromEntries(
      Object.keys(productIds)
        .sort()
        .map((slug) => [slug, productIds[slug]]),
    ),
    byProduct: sorted,
  };
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(
    `Judge.me: ${reviews.length} fetched, ${kept} published across ` +
      `${Object.keys(sorted).length} product(s).`,
  );
  if (skipped > 0) {
    console.log(`  ${skipped} skipped (hidden, unpublished, spam or empty).`);
  }
  if (unmapped.size > 0) {
    /* Withdrawn products keep their reviews at Judge.me, so this is a note,
     * not a fault. */
    console.log(`  no longer in the catalogue: ${[...unmapped].join(", ")}`);
  }
  if (unknownVerified.size > 0) {
    console.warn(
      `  WARNING: unrecognised "verified" value(s) from Judge.me: ` +
        `${[...unknownVerified].join(", ")}\n` +
        `  Treated as unverified, so those reviews publish without the badge.\n` +
        `  If Judge.me shows them as verified, add the value to ` +
        `VERIFIED_VALUES in scripts/reviews/fetch.ts.`,
    );
  }
  console.log(`Wrote ${OUT}`);
}

type ReviewRow = {
  id: number;
  author: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  verified: boolean;
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
