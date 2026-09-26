/**
 * Publishes the storefront's policies to Shopify.
 *
 *   npx tsx scripts/shopify/store-policies.ts               # read only: shows what would change
 *   npx tsx scripts/shopify/store-policies.ts --preview p   # writes an HTML proof to p
 *   npx tsx scripts/shopify/store-policies.ts --apply       # writes them to the store
 *
 * ## Why this exists
 *
 * Shopify's checkout footer links to the *store's* policy objects, not to
 * theheavencraft.in/policies/. Those are two different documents, and when
 * the cart opened to real customers only the privacy policy was published --
 * refund, shipping, terms and contact information were all 404 at the moment
 * money started moving. A shopper who clicks "Refund policy" while entering
 * their card details is exactly the shopper who needs it to load.
 *
 * ## Why it renders from src/lib/policies.ts rather than holding its own copy
 *
 * Two hand-maintained sets of legal text drift, and the drift is invisible
 * because nobody reads either one until there is a dispute. This renders the
 * same `POLICIES` array the site publishes, so re-running after a copy change
 * re-syncs the store and the two can only ever say the same thing.
 *
 * Contact information has no equivalent on the site -- it is assembled from
 * `SITE`, which is where the address, phone and hours already live.
 */

import { writeFileSync } from "node:fs";

import { POLICIES, type Policy } from "../../src/lib/policies";
import { SITE } from "../../src/lib/site";
import { loadEnv, shopifyGraphql, type ShopifyEnv } from "./client";

const APPLY = process.argv.includes("--apply");

const PREVIEW: string | null = (() => {
  const i = process.argv.indexOf("--preview");
  return i === -1 ? null : (process.argv[i + 1] ?? null);
})();

/**
 * Shopify's `ShopPolicyType` values, mapped to our policy slugs.
 *
 * `shopPolicyUpdate` keys on the type and upserts, so a policy that has never
 * existed on the store is created by the same call that would edit it.
 *
 * Privacy is deliberately not synced. Shopify generates a long privacy policy
 * that describes data processing *at its own checkout* -- processors, cookies,
 * regional rights -- none of which this site can speak for, and all of which
 * becomes relevant precisely when a customer is on that checkout. Ours is a
 * short reader-facing summary of what the static site does. Overwriting
 * fifteen thousand characters of that with thirteen hundred would be a loss of
 * cover, not a tidy-up, so the two documents stay separate on purpose.
 */
const MAPPING: {
  type: string;
  slug: string | null;
  label: string;
  hold?: string;
}[] = [
  { type: "REFUND_POLICY", slug: "returns", label: "Refund policy" },
  { type: "SHIPPING_POLICY", slug: "shipping", label: "Shipping policy" },
  { type: "TERMS_OF_SERVICE", slug: "terms", label: "Terms of service" },
  {
    type: "PRIVACY_POLICY",
    slug: "privacy",
    label: "Privacy policy",
    hold: "Shopify's own covers its checkout in far more detail",
  },
  { type: "CONTACT_INFORMATION", slug: null, label: "Contact information" },
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderPolicy(policy: Policy): string {
  const parts: string[] = [`<p><em>${escapeHtml(policy.summary)}</em></p>`];

  for (const section of policy.sections) {
    parts.push(`<h3>${escapeHtml(section.heading)}</h3>`);
    for (const paragraph of section.body) {
      parts.push(`<p>${escapeHtml(paragraph)}</p>`);
    }
  }

  /* Shopify's policy pages are a dead end -- they have no navigation back to
   * the storefront -- so each one ends with a way home. */
  parts.push(
    `<p><a href="${SITE.origin}/policies/${policy.slug}/">Read this on ${SITE.origin.replace("https://", "")}</a></p>`,
  );

  return parts.join("\n");
}

function renderContact(): string {
  const hours = SITE.openingHours
    .map((block) => `${block.days.join(", ")}: ${block.opens}-${block.closes}`)
    .join("<br>");

  return [
    `<p><strong>${escapeHtml(SITE.legalName)}</strong></p>`,
    `<p>${escapeHtml(SITE.street)}<br>${escapeHtml(SITE.city)} ${SITE.postalCode}<br>India</p>`,
    `<p>Phone and WhatsApp: <a href="tel:${SITE.phone}">${escapeHtml(SITE.phoneDisplay)}</a><br>`,
    `Email: <a href="mailto:${SITE.email}">${escapeHtml(SITE.email)}</a></p>`,
    `<h3>Showroom hours</h3>`,
    `<p>${hours}</p>`,
    `<p>We reply to email and WhatsApp within one working day.</p>`,
  ].join("\n");
}

function bodyFor(entry: (typeof MAPPING)[number]): string {
  if (entry.slug === null) return renderContact();

  const policy = POLICIES.find((p) => p.slug === entry.slug);
  if (!policy) {
    throw new Error(
      `No policy with slug "${entry.slug}" in src/lib/policies.ts. ` +
        `Either it was renamed, or MAPPING is out of date.`,
    );
  }
  return renderPolicy(policy);
}

type RemotePolicy = { id: string; type: string; url: string | null; body: string | null };

const READ = `
  query ShopPolicies {
    shop {
      shopPolicies { id type url body }
    }
  }
`;

const WRITE = `
  mutation ShopPolicyUpdate($shopPolicy: ShopPolicyInput!) {
    shopPolicyUpdate(shopPolicy: $shopPolicy) {
      shopPolicy { id type url }
      userErrors { field message }
    }
  }
`;

/**
 * Writes the exact bodies that `--apply` would publish, as one page.
 *
 * Reviewing legal text in a terminal is how a wrong sentence gets approved, so
 * this renders it the way a customer meets it. It makes no network call: the
 * point is to read the words, and they come from the repo.
 */
function writePreview(path: string): void {
  const cards = MAPPING.map((entry) => {
    if (entry.hold) {
      return `<section class="hold"><h2>${escapeHtml(entry.label)}</h2>
        <p class="note">Not published by this script &mdash; ${escapeHtml(entry.hold)}.</p></section>`;
    }
    return `<section><h2>${escapeHtml(entry.label)}</h2>
      <p class="note">Shopify type <code>${entry.type}</code></p>
      <article>${bodyFor(entry)}</article></section>`;
  }).join("\n");

  writeFileSync(
    path,
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Shopify storefront policies &mdash; proof</title>
<style>
  :root { color-scheme: light }
  body { font: 16px/1.65 ui-sans-serif, system-ui, sans-serif; max-width: 46rem;
         margin: 0 auto; padding: 2.5rem 1.25rem 6rem; color: #1a1a1a }
  h1 { font-size: 1.6rem; margin-bottom: .25rem }
  .lede { color: #555; margin-top: 0 }
  section { margin-top: 2.5rem; border-top: 1px solid #e5e5e5; padding-top: 1.5rem }
  h2 { font-size: 1.15rem; margin-bottom: .2rem }
  .note { color: #666; font-size: .85rem; margin-top: 0 }
  .hold .note { color: #8a5a00 }
  article { background: #fafafa; border: 1px solid #ececec; border-radius: 8px;
            padding: 1rem 1.25rem }
  article h3 { font-size: .95rem; margin: 1.2rem 0 .3rem }
  article p { margin: .4rem 0 }
  code { background: #f0f0f0; padding: .1rem .3rem; border-radius: 3px; font-size: .85em }
</style></head><body>
<h1>Shopify storefront policies</h1>
<p class="lede">These are the exact bodies <code>--apply</code> would publish to the store,
rendered from <code>src/lib/policies.ts</code>. Nothing has been written yet.</p>
${cards}
</body></html>`,
    "utf8",
  );

  console.log(`Wrote ${path}`);
  console.log("Nothing was sent to Shopify. Re-run with --apply to publish.");
}

async function main(): Promise<void> {
  if (PREVIEW) {
    writePreview(PREVIEW);
    return;
  }

  const env: ShopifyEnv = loadEnv();

  console.log(
    APPLY
      ? "Publishing storefront policies to Shopify.\n"
      : "Storefront policies -- read only, nothing will be written.\n",
  );

  let remote: RemotePolicy[];
  try {
    const data = await shopifyGraphql<{ shop: { shopPolicies: RemotePolicy[] } }>(
      env,
      READ,
      {},
    );
    remote = data.shop.shopPolicies;
  } catch (cause) {
    const message = (cause as Error).message;
    if (/access scope|access denied|not approved/i.test(message)) {
      console.error(
        "Cannot read the store's policies: the app is missing the\n" +
          "`write_legal_policies` scope.\n\n" +
          "In the Shopify dev dashboard open your app -> Configuration -> Access\n" +
          "scopes, add it, release the version, then approve the change on the\n" +
          "store. Re-run `npm run shopify:preflight` to confirm.\n",
      );
      process.exitCode = 1;
      return;
    }
    throw cause;
  }

  const byType = new Map(remote.map((p) => [p.type, p]));
  let created = 0;
  let changed = 0;

  for (const entry of MAPPING) {
    const current = byType.get(entry.type);

    if (entry.hold) {
      const size = (current?.body ?? "").trim().length;
      console.log(
        `  hold     ${entry.label.padEnd(20)} left as-is (${size ? size + " chars" : "empty"}) -- ${entry.hold}`,
      );
      continue;
    }

    const body = bodyFor(entry);
    const same = (current?.body ?? "").trim() === body.trim();
    if (same) {
      console.log(`  same     ${entry.label.padEnd(20)} already matches the site`);
      continue;
    }

    const isNew = !current || !(current.body ?? "").trim();
    if (isNew) created++;
    else changed++;

    const was = (current?.body ?? "").trim().length;
    const verb = APPLY ? (isNew ? "CREATE  " : "WRITE   ") : isNew ? "would add" : "would edit";
    console.log(
      `  ${verb.padEnd(9)} ${entry.label.padEnd(20)} ` +
        `${was === 0 ? "nothing" : was + " chars"} -> ${body.length} chars`,
    );

    if (!APPLY) continue;

    const result = await shopifyGraphql<{
      shopPolicyUpdate: {
        shopPolicy: { url: string | null } | null;
        userErrors: { field: string[] | null; message: string }[];
      };
    }>(env, WRITE, { shopPolicy: { type: entry.type, body } });

    const errors = result.shopPolicyUpdate.userErrors;
    if (errors.length) {
      console.error(
        `           failed: ${errors.map((e) => e.message).join("; ")}`,
      );
      process.exitCode = 1;
      continue;
    }
    console.log(`           published: ${result.shopPolicyUpdate.shopPolicy?.url ?? "(no url)"}`);
  }

  const total = created + changed;
  console.log("");
  if (!APPLY && total) {
    console.log(
      `${created} to add, ${changed} to edit. Re-run with --apply to publish.`,
    );
  }
  if (APPLY && !total) {
    console.log("Nothing to do -- the store already matches the site.");
  }
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
