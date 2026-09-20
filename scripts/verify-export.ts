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

const OUT = join(process.cwd(), "out");
const MIN_PAGES = 60;

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

if (pages.length < MIN_PAGES) {
  fail(`only ${pages.length} pages exported, expected at least ${MIN_PAGES}`);
}
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
if (locs.length < MIN_PAGES - 5) fail(`sitemap lists only ${locs.length} urls`);
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
if (redirectTargets.length < 34) {
  fail(`only ${redirectTargets.length} legacy /product/ redirects, expected 34`);
}
for (const target of redirectTargets) {
  if (!resolves(target)) fail(`redirect target ${target} does not exist`);
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
