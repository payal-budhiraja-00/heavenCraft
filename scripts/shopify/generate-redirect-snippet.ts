/**
 * Generates the Liquid snippet that turns the Shopify online store from a
 * second, competing storefront into a redirector.
 *
 * ## Why this is needed
 *
 * The cart is a tokenless Storefront API client, and `cart.checkoutUrl` is
 * only minted for products published to the Online Store sales channel. So
 * the channel has to stay on -- which means Shopify serves a complete second
 * storefront on `shop.theheavencraft.in`, with its own theme, its own product
 * pages and its own copy of all 26 products.
 *
 * That is a duplicate of the real site: it competes with it in search, it
 * looks nothing like it, and it is where Shopify sends the buyer when they
 * press "Continue shopping" after paying.
 *
 * ## Why a theme snippet rather than something cleaner
 *
 * - Liquid cannot issue a 301; it renders a body, it does not set a status.
 *   So the redirect is a canonical link plus `noindex` for crawlers, and a
 *   history-replacing script for people.
 * - Checkout does not render the theme layout, so nothing here can touch a
 *   checkout in progress. That is what makes this safe to do on a live store.
 * - Password-protecting the store would be one click, but this store's
 *   Storefront access is deliberately tokenless, and tokenless reads are not
 *   covered by the password bypass. It would be gambling live checkout.
 *
 * Run: npm run shopify:redirect-snippet
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalog, type ShopifyProduct } from "./payload";

const SITE = "https://theheavencraft.in";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "..", "shopify-theme", "heavencraft-redirect.liquid");

/** The marketing site's top-level group for a product, e.g. "chairs". */
function groupOf(product: ShopifyProduct): string {
  return product.sourceHref.split("/")[1] ?? "";
}

function main(): void {
  const catalog = buildCatalog();
  const groups = [...new Set(catalog.map(groupOf))].filter(Boolean).sort();

  /* Generated rather than hand-kept: the first product rename would rot a
     copy maintained by hand, and it would rot silently. */
  const productCases = catalog
    .map(
      (p) =>
        `      {%- when '${p.handle}' -%}{%- assign target = site | append: '${p.sourceHref}' -%}`,
    )
    .join("\n");

  const groupCases = groups
    .map(
      (g) =>
        `      {%- when '${g}' -%}{%- assign target = site | append: '/${g}/' -%}`,
    )
    .join("\n");

  const liquid = `{%- comment -%}
  HeavenCraft -- send this store to theheavencraft.in.

  GENERATED FILE. Do not hand-edit.
  Regenerate with: npm run shopify:redirect-snippet

  Paste the whole of this file immediately after the opening <head> tag in
  layout/theme.liquid. Checkout and the order status page do not render this
  layout, so a checkout in progress is never affected by it.
{%- endcomment -%}

{%- liquid
  assign site = '${SITE}'
  assign target = site
-%}

{%- if request.page_type == 'product' -%}
  {%- case product.handle -%}
${productCases}
  {%- endcase -%}
{%- endif -%}

{%- if request.page_type == 'collection' -%}
  {%- case collection.handle -%}
${groupCases}
  {%- endcase -%}
{%- endif -%}

{%- comment -%}
  This pair is what actually removes the duplicate from search results. The
  script below only moves people; a crawler obeys these two.
{%- endcomment -%}
<link rel="canonical" href="{{ target }}">
<meta name="robots" content="noindex, follow">

<script>
  (function () {
    var path = window.location.pathname;
    /* Checkout does not render this layout today -- /cart/c/<token> answers
       with a bare 302 straight to /checkouts/cn/, so no markup of ours ever
       reaches a buyer mid-payment. That is Shopify's behaviour, not a promise,
       and bouncing someone out of a half-finished payment would be
       unforgivable, so the cart paths are guarded too. Nothing is lost by it:
       our own cart is a drawer served from the Storefront API, so a shopper
       has no reason to be on this store's /cart in the first place. */
    if (/^\\/(cart|checkouts?|account|orders|tools|services|apps|wpm)\\b/.test(path)) return;
    /* replace(), not assign(), so Back does not bounce the visitor again. */
    window.location.replace({{ target | json }});
  })();
</script>

<noscript>
  <meta http-equiv="refresh" content="0; url={{ target }}">
</noscript>
`;

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, liquid, "utf8");

  console.log("Wrote shopify-theme/heavencraft-redirect.liquid");
  console.log(`  ${catalog.length} product handles -> their page on the site`);
  console.log(`  ${groups.length} group handles     -> ${groups.join(", ")}`);
}

main();
