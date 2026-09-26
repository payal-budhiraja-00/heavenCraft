/*
 * Verifies the contents of `out/` before it is allowed near the live site.
 *
 * The old site froze for eight weeks because a broken build still deployed:
 * nothing inspected the output. Static hosting has no server to paper over a
 * mistake, so every one of these failures would be visible to a visitor or to
 * Google. This runs in CI between `build` and the FTP upload.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { allProducts, groups } from "../src/lib/catalog";
import { SITE } from "../src/lib/site";
import { LEGACY_REDIRECTS } from "./legacy-redirects";

const OUT = join(process.cwd(), "out");

const problems: string[] = [];
const fail = (msg: string) => problems.push(msg);

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const toUrl = (file: string) => "/" + relative(OUT, file).split(sep).join("/");

/** First capture group of every match, with non-participating groups dropped. */
const captures = (text: string, re: RegExp): string[] =>
  [...text.matchAll(re)].flatMap((m) => (m[1] === undefined ? [] : [m[1]]));

let files: string[];
try {
  files = walk(OUT);
} catch {
  console.error("out/ does not exist — did the build run?");
  process.exit(1);
}

const pages = files.filter((f) => f.endsWith(".html"));
const present = new Set(files.map(toUrl));

/* ---------------------------------------------------------------- 1. shape */

for (const required of [
  "/index.html",
  "/404.html",
  "/404.php",
  "/sitemap.xml",
  "/robots.txt",
  "/.htaccess",
  "/favicon.ico",
  "/site.webmanifest",
  "/og/default.jpg",
]) {
  if (!present.has(required)) fail(`missing required file ${required}`);
}

/**
 * `public/` is copied verbatim into the export, so anything dropped in it is
 * published. A 6.5 MB `products.zip` sat at a guessable URL this way, next to
 * macOS `.DS_Store` files and two READMEs addressed to whoever was uploading
 * photographs. None of it was referenced by a page, so nothing caught it.
 */
for (const file of files) {
  const url = toUrl(file);
  if (!url.startsWith("/images/")) continue;
  if (/\/\.DS_Store$/.test(url) || /\.zip$/i.test(url) || /\/README\.md$/i.test(url)) {
    fail(`junk file published: ${url}`);
  }
}

/* ------------------------------------------- 2. links and assets resolve */

const resolves = (url: string) => {
  const bare = url.split("#")[0]?.split("?")[0] ?? "";
  let p: string;
  try {
    p = decodeURI(bare);
  } catch {
    return false;
  }
  return (
    p === "" ||
    present.has(p) ||
    present.has(p + "index.html") ||
    present.has(p + "/index.html")
  );
};

const brokenLinks = new Map<string, string>();

/** Bytes of an exported file, or 0 if it is not there. */
const sizeOf = (url: string) => {
  try {
    return statSync(join(OUT, decodeURI(url).slice(1))).size;
  } catch {
    return 0;
  }
};

/*
 * Every URL the catalog implies must have been exported.
 *
 * This replaced a hardcoded "at least 60 pages". That number was the catalog
 * size on the day it was written, and it failed the moment the September 2026
 * range change shrank the catalog to 26 products -- a false failure, which is
 * the worst kind, because the obvious fix is to edit the number down until it
 * passes and nobody asks what it was guarding. It also never checked what it
 * appeared to: sixty pages of the wrong sixty would have passed.
 *
 * Naming each expected URL stays accurate under a deliberate range change,
 * is stricter than any count, and says which page is missing rather than
 * merely that one is.
 */
for (const group of groups) {
  if (!resolves(group.href)) fail(`group page ${group.href} was not exported`);

  for (const sub of group.subCategories) {
    // A collapsed range has no page of its own: the URL belongs to its only
    // product, which is asserted below.
    if (sub.collapsed) continue;
    if (!resolves(sub.href)) fail(`range page ${sub.href} was not exported`);
  }
}
for (const product of allProducts) {
  if (!resolves(product.href)) fail(`product page ${product.href} was not exported`);
}

/* ------------------------------------------------------ 3. per-page <head> */

/*
 * Attribute values arrive HTML-escaped, so "&" is five characters and an
 * unescaped apostrophe is six. Measuring a snippet without decoding first
 * overstates its length and fails a description that is actually fine.
 */
const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'")
    .replace(/&amp;/g, "&");

const titles = new Map<string, string>();
const canonicals = new Map<string, string>();

for (const file of pages) {
  const url = toUrl(file);
  const html = readFileSync(file, "utf8");
  const head = html.slice(0, html.indexOf("</head>"));
  const all = (re: RegExp) => captures(head, re);

  const refs = [
    ...captures(html, /href="([^"]+)"/g),
    ...captures(html, /src="([^"]+)"/g),
    // Every responsive candidate, not just the fallback src. These URLs are
    // computed by src/lib/image-loader.ts from a hash of the source path and
    // written separately by scripts/generate-images.ts, so a drift between
    // the two would break every image on the site while leaving `src` — the
    // largest width, which both agree on — looking perfectly fine.
    ...captures(html, /srcSet="([^"]+)"/g).flatMap((set) =>
      set.split(",").map((candidate) => candidate.trim().split(/\s+/)[0] ?? ""),
    ),
  ];

  for (const ref of refs) {
    if (!ref.startsWith("/") || ref.startsWith("//")) continue;
    if (!resolves(ref) && !brokenLinks.has(ref)) brokenLinks.set(ref, url);
  }

  const title = all(/<title[^>]*>([^<]*)<\/title>/g);
  const desc = all(/<meta name="description" content="([^"]*)"/g);
  const canonical = all(/<link rel="canonical" href="([^"]+)"/g);
  const ogImage = all(/<meta property="og:image" content="([^"]+)"/g);
  const noindex = /content="[^"]*noindex/.test(head);

  if (title.length !== 1) fail(`${title.length} <title> tags on ${url}`);
  if (desc.length !== 1) fail(`${desc.length} meta descriptions on ${url}`);
  if (ogImage.length !== 1) fail(`${ogImage.length} og:image on ${url}`);
  if (!noindex && canonical.length !== 1) {
    fail(`${canonical.length} canonical tags on ${url}`);
  }

  /*
    A snippet is cut around 160 characters, and the cut lands wherever it
    lands -- usually mid-word, and always after the part that says why to buy
    from us. Descriptions are composed to fit, so anything over the limit
    means a call site built one by hand and bypassed composeDescription().
  */
  const text = decode(desc[0] ?? "");
  if (text.length > 160) {
    fail(`meta description is ${text.length} chars on ${url}`);
  }

  /*
    og:image is absolute, so the relative broken-reference sweep above cannot
    see it. Nothing else can either: a social card is only ever fetched by a
    crawler, so a missing one fails silently and is discovered when a shared
    link unfurls blank -- typically months later, on someone else's phone.

    The cards are generated in `prebuild` from products.json, which means a
    product added without a rerun would reference a file that was never made.
   */
  const card = ogImage[0] ?? "";
  const cardPath = card.startsWith(SITE.origin)
    ? card.slice(SITE.origin.length)
    : card;
  if (!cardPath.startsWith("/")) {
    fail(`og:image is not on ${SITE.origin} (${card} on ${url})`);
  } else if (!resolves(cardPath)) {
    fail(`og:image missing from export: ${cardPath} (on ${url})`);
  }

  // WhatsApp is the dominant share surface in this market and will not fetch
  // a card much past 600 kB. Facebook and X are looser but not unbounded.
  const cardBytes = cardPath.startsWith("/") ? sizeOf(cardPath) : 0;
  if (cardBytes > 500_000) {
    fail(`og:image is ${Math.round(cardBytes / 1024)} kB: ${cardPath}`);
  }

  // Without these a card is fetched, measured and often re-cropped by the
  // consumer; with them it is laid out correctly before the bytes arrive.
  if (!/<meta property="og:image:width"/.test(head)) {
    fail(`og:image has no declared width on ${url}`);
  }

  // Reviews on this site are seeded demo content. Emitting them as ratings
  // would be a search-policy breach, so the build must never produce one.
  if (html.includes("aggregateRating")) fail(`aggregateRating on ${url}`);

  // Anything left over from the Create React App site.
  for (const leftover of ["logo192", "logo512", "Create React App"]) {
    if (html.includes(leftover)) fail(`"${leftover}" still present on ${url}`);
  }

  if (noindex) continue;
  if (title[0]) titles.set(url, title[0]);
  if (canonical[0]) canonicals.set(url, canonical[0]);
}

for (const [ref, on] of brokenLinks) fail(`broken reference ${ref} (on ${on})`);

/*
 * The business facts, asserted once against the homepage.
 *
 * These are the values a customer phones, a courier drives to and Google
 * cross-checks against the Business Profile. A typo in any of them is not a
 * cosmetic defect: a wrong phone number is a silently lost order, and a
 * LocalBusiness address that disagrees with the Business Profile costs the
 * map listing the schema was added to win.
 */
{
  const home = readFileSync(join(OUT, "index.html"), "utf8");

  const ld = [...home.matchAll(/type="application\/ld\+json">(.*?)<\/script>/gs)]
    .map((m) => m[1] ?? "")
    .join(" ");

  if (!ld.includes('"FurnitureStore"')) {
    fail("homepage is missing FurnitureStore schema");
  }
  for (const fact of [
    SITE.phone,
    SITE.street,
    SITE.postalCode,
    SITE.legalName,
  ]) {
    if (!ld.includes(fact)) fail(`business schema is missing "${fact}"`);
  }
  for (const profile of SITE.sameAs) {
    if (!ld.includes(profile)) fail(`sameAs is missing ${profile}`);
  }

  // A number nobody can tap is a number nobody calls.
  if (!home.includes(`tel:${SITE.phone}`)) {
    fail("homepage has no tel: link");
  }
  if (!home.includes(`wa.me/${SITE.whatsapp}`)) {
    fail("homepage has no WhatsApp link");
  }
}

const reportDuplicates = (map: Map<string, string>, label: string) => {
  const byValue = new Map<string, string[]>();
  for (const [url, value] of map) {
    byValue.set(value, [...(byValue.get(value) ?? []), url]);
  }
  for (const [value, urls] of byValue) {
    if (urls.length > 1) {
      fail(`duplicate ${label} "${value}" on ${urls.length} pages: ${urls.slice(0, 3).join(", ")}`);
    }
  }
};
reportDuplicates(titles, "title");
reportDuplicates(canonicals, "canonical");

/* --------------------------------------------------------- 4. sitemap */

const sitemap = readFileSync(join(OUT, "sitemap.xml"), "utf8");
const locs = captures(sitemap, /<loc>([^<]+)<\/loc>/g);
/*
 * The sitemap is what Google crawls, so a page missing from it is a page that
 * may never be found -- and unlike a broken link, nothing on the site reveals
 * the omission. Asserted against the catalog for the same reason as above.
 */
const listed = new Set(locs.map((loc) => loc.replace(/^https?:\/\/[^/]+/, "")));
for (const group of groups) {
  if (!listed.has(group.href)) fail(`sitemap omits group page ${group.href}`);
  for (const sub of group.subCategories) {
    if (sub.collapsed) continue;
    if (!listed.has(sub.href)) fail(`sitemap omits range page ${sub.href}`);
  }
}
for (const product of allProducts) {
  if (!listed.has(product.href)) fail(`sitemap omits ${product.href}`);
}
for (const loc of locs) {
  const path = loc.replace(/^https?:\/\/[^/]+/, "");
  if (!resolves(path)) fail(`sitemap lists ${loc}, which does not exist`);
  if (/\s/.test(loc)) fail(`sitemap url is not encoded: ${loc}`);
}

/* ------------------------------------------------------- 5. .htaccess */

const htaccess = readFileSync(join(OUT, ".htaccess"), "utf8");
// Line-anchored: the surrounding comment block quotes the directive while
// explaining why this host ignores it, and an unanchored match reads that
// instead of the real one.
const errorDoc = htaccess.match(/^\s*ErrorDocument\s+404\s+(\S+)/m)?.[1];
if (!errorDoc) fail("no ErrorDocument 404 in .htaccess");
else if (!present.has(errorDoc)) {
  fail(`ErrorDocument points at ${errorDoc}, which does not exist`);
}

/*
  The shim is what actually produces the 404 on this host -- the platform
  ignores ErrorDocument however it is pointed, at a static file or at PHP --
  and it works by setting the status itself and printing the branded page.
  Two ways it could quietly stop doing that: losing the status call, leaving
  a soft 200 that tells Google a dead URL is a real page; or losing the
  reference to 404.html, leaving visitors the bare fallback markup instead of
  the real page. Neither breaks the build, and neither is visible without
  asking for a URL that does not exist, so assert both here.
*/
const shim = readFileSync(join(OUT, "404.php"), "utf8");
if (!/http_response_code\(404\)/.test(shim)) {
  fail("404.php does not set a 404 status, so dead URLs would answer 200");
}
if (!shim.includes("404.html")) {
  fail("404.php no longer reads 404.html, so the branded page is not served");
}

/*
 * ErrorDocument is declared but inert on this host, so what actually reaches
 * a visitor on a dead URL is the rewrite catch-all. It is three lines and
 * every one of them is load-bearing:
 *
 *  - without `!-f` it would shadow every real file on the site;
 *  - without `!-d` it would shadow every directory index, i.e. every page;
 *  - and without either, it would also rewrite `/404.php` onto itself.
 *
 * Losing it doesn't fail a build -- it just quietly restores the grey default
 * page nobody looks at.
 */
const catchAll = htaccess.search(/^\s*RewriteRule \^ \/404\.php \[L\]/m);
if (catchAll === -1) {
  fail("no rewrite catch-all to /404.php — dead URLs get the host's own page");
} else {
  const guard = htaccess.slice(0, catchAll);
  const guarded =
    /RewriteCond %\{REQUEST_FILENAME\} !-f\s*\n\s*RewriteCond %\{REQUEST_FILENAME\} !-d\s*$/.test(
      guard.trimEnd() + "\n",
    );
  if (!guarded) {
    fail("catch-all is missing its !-f/!-d guards and would shadow real pages");
  }
  /*
   * mod_rewrite stops at the first rule that matches and carries [L], so the
   * catch-all has to be last. A 301 written below it is unreachable for
   * exactly the URLs it exists to serve -- the withdrawn ones, which have no
   * file on disk -- and it fails silently, because the target still exists
   * and the redirect is still present in the file.
   */
  if (/^\s*RewriteRule \S+ \S+ \[R=301,L\]/m.test(htaccess.slice(catchAll))) {
    fail("a 301 rewrite is written below the catch-all, so it can never fire");
  }
}

/*
 * No mod_alias here, and this is not a style preference. mod_rewrite
 * registers its fixup hook APR_HOOK_FIRST and mod_alias registers
 * fixup_redir APR_HOOK_MIDDLE, so within one .htaccess every RewriteRule is
 * evaluated before any Redirect regardless of the order they are written in.
 * A `Redirect` added back would sit below the catch-all in effect, not in
 * text, and the withdrawn URL it was written for would 404 instead.
 */
if (/^\s*Redirect(Match|Permanent|Temp)?\s+\d/m.test(htaccess)) {
  fail("mod_alias Redirect in .htaccess — the rewrite catch-all preempts it");
}

// TLS terminates at Cloudflare, so %{HTTPS} is "off" at this origin even for
// HTTPS visitors. A redirect keyed on it would loop until the browser gives up.
if (/RewriteCond\s+%\{HTTPS\}/.test(htaccess)) {
  fail(".htaccess redirects on %{HTTPS} — this loops behind Cloudflare");
}

/*
 * Sources and targets are read as pairs from the same anchored shape --
 * `RewriteRule ^chairs/rider-leather-chair/?$ /chairs/ [R=301,L]` -- which
 * also excludes the canonical-host rule, whose target is an absolute URL on
 * this same site and would not resolve as a path.
 *
 * Strip the optional trailing slash back off to recover the plain path, drop
 * the backslashes the generator added to escape regex metacharacters, and put
 * back the leading slash that per-directory mod_rewrite matches without.
 */
const redirectPairs = [
  ...htaccess.matchAll(/^\s*RewriteRule \^(\S+?)\/\?\$ (\S+) \[R=301,L\]/gm),
].map(([, source, target]) => ({
  source: `/${(source ?? "").replace(/\\(.)/g, "$1").replace(/\/$/, "")}`,
  target: target ?? "",
}));
const redirectTargets = redirectPairs.map((pair) => pair.target);
const redirectSources = new Set(redirectPairs.map((pair) => pair.source));

/*
 * Checked by membership rather than by count.
 *
 * The count was a hardcoded 34 and it caught nothing useful: any edit that
 * dropped a redirect while adding two elsewhere still passed, and a range
 * change made the number wrong without making the redirects wrong. Asserting
 * that each URL we know to be dead is actually listed is the check that was
 * intended.
 */
for (const product of allProducts) {
  if (!redirectSources.has(`/product/${product.id}`)) {
    fail(`no /product/${product.id} redirect for ${product.name}`);
  }
}
for (const { from } of LEGACY_REDIRECTS) {
  if (!redirectSources.has(from.replace(/\/$/, ""))) {
    fail(`no redirect for withdrawn URL ${from}`);
  }
}
for (const target of redirectTargets) {
  if (!resolves(target)) fail(`redirect target ${target} does not exist`);
}

// A redirect whose source still resolves is dead config at best and shadows a
// live page at worst -- the rule carries [L], so it answers with a 301 before
// the file on disk is ever reached.
for (const source of redirectSources) {
  if (source !== "/search" && resolves(`${source}/`)) {
    fail(`redirect source ${source} still resolves to a real page`);
  }
}

/* ------------------------------------------------------------- report */

if (problems.length) {
  console.error(`\nExport verification failed — ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  • ${problem}`);
  console.error("");
  process.exit(1);
}

console.log(
  `Export verified: ${pages.length} pages, ${locs.length} sitemap urls, ` +
    `${redirectTargets.length} legacy redirects, no metadata defects.`,
);
