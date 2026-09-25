/*
 * Verifies the contents of `out/` before it is allowed near the live site.
 *
 * The old site froze for eight weeks because a broken build still deployed:
 * nothing inspected the output. Static hosting has no server to paper over a
 * mistake, so every one of these failures would be visible to a visitor or to
 * Google. This runs in CI between `build` and the FTP upload.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { allProducts, groups } from "../src/lib/catalog";
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
  "/sitemap.xml",
  "/robots.txt",
  "/.htaccess",
  "/favicon.ico",
  "/site.webmanifest",
  "/og/default.png",
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
const errorDoc = htaccess.match(/ErrorDocument\s+404\s+(\S+)/)?.[1];
if (!errorDoc) fail("no ErrorDocument 404 in .htaccess");
else if (!present.has(errorDoc)) {
  fail(`ErrorDocument points at ${errorDoc}, which does not exist`);
}

// TLS terminates at Cloudflare, so %{HTTPS} is "off" at this origin even for
// HTTPS visitors. A redirect keyed on it would loop until the browser gives up.
if (/RewriteCond\s+%\{HTTPS\}/.test(htaccess)) {
  fail(".htaccess redirects on %{HTTPS} — this loops behind Cloudflare");
}

const redirectTargets = captures(htaccess, /^\s*Redirect 301 \S+ (\S+)/gm);

/*
 * Checked by membership rather than by count.
 *
 * The count was a hardcoded 34 and it caught nothing useful: any edit that
 * dropped a redirect while adding two elsewhere still passed, and a range
 * change made the number wrong without making the redirects wrong. Asserting
 * that each URL we know to be dead is actually listed is the check that was
 * intended.
 */
const redirectSources = new Set(
  captures(htaccess, /^\s*Redirect 301 (\S+)/gm).map((s) => s.replace(/\/$/, "")),
);
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
// live page at worst -- mod_alias answers before the file is ever looked for.
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
