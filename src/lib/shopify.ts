/**
 * Shopify Storefront API transport.
 *
 * ## Why there is no API token here
 *
 * The Storefront API has a tokenless access mode covering products,
 * collections, search and the entire Cart surface, rate-limited per buyer IP
 * instead of per credential. That is the whole reason this site can stay a
 * static export on cPanel: there is no server to hold a secret, and there is
 * no secret to hold. Verified against this store for `shop`, `products`,
 * `cartCreate` and `cart`.
 *
 * Browser calls are cross-origin -- `theheavencraft.in` talking to
 * `shop.theheavencraft.in` -- and Shopify answers with
 * `access-control-allow-origin: *` plus an OPTIONS preflight that permits
 * POST with `content-type`. Also verified, because if it had not been, every
 * cart call would have failed in the browser while working perfectly from
 * curl.
 *
 * ## Why this domain and not the myshopify one
 *
 * `cart.checkoutUrl` is minted on whatever Shopify considers the store's
 * *primary* domain. Point this at `theheavencraft.myshopify.com` and carts
 * would still build correctly -- but the checkout URL they hand back would
 * be on a domain GoDaddy serves, and every "Pay now" would 404. The primary
 * domain is `shop.theheavencraft.in`, so that is what this talks to.
 *
 * ## Why the version is pinned
 *
 * Shopify expires API versions on a published calendar. An unpinned URL
 * silently rolls forward and a breaking change lands as a runtime error in a
 * customer's cart rather than a build failure.
 */

export const SHOPIFY_DOMAIN = "shop.theheavencraft.in";
export const STOREFRONT_API_VERSION = "2026-07";
export const STOREFRONT_ENDPOINT = `https://${SHOPIFY_DOMAIN}/api/${STOREFRONT_API_VERSION}/graphql.json`;

type GraphqlError = { message: string };

type GraphqlResponse<T> = {
  data?: T;
  errors?: GraphqlError[];
};

export class StorefrontError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorefrontError";
  }
}

/**
 * One GraphQL round trip.
 *
 * Shopify answers a malformed query, an expired API version and a permission
 * failure all with **HTTP 200** and an `errors` array, so the status code is
 * close to meaningless on its own and both have to be checked.
 */
export async function storefront<T>(
  query: string,
  variables: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(STOREFRONT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal,
    });
  } catch (cause) {
    // Offline, DNS failure, or the request was aborted by a cancelled render.
    throw new StorefrontError(
      cause instanceof Error ? cause.message : "Network request failed",
    );
  }

  if (!res.ok) {
    throw new StorefrontError(`Storefront API returned HTTP ${res.status}`);
  }

  const json = (await res.json()) as GraphqlResponse<T>;

  if (json.errors?.length) {
    throw new StorefrontError(
      json.errors.map((error) => error.message).join("; "),
    );
  }

  if (!json.data) {
    throw new StorefrontError("Storefront API returned no data");
  }

  return json.data;
}
