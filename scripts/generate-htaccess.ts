/**
 * Writes `public/.htaccess`, which Next copies into `out/` on export.
 *
 * The product redirects are generated from the catalog rather than typed by
 * hand, because the old site addressed products as `/product/<id>` and the new
 * one addresses them as `/<group>/<slug>/`. Every one of those old URLs may be
 * in someone's bookmarks or in Google's index, and a redirect map that drifts
 * out of sync with the catalog is worse than none: it 404s silently.
 *
 * Run automatically before `next build`.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { allProducts } from "../src/lib/catalog";
import { LEGACY_REDIRECTS } from "./legacy-redirects";

const OUT = path.join(process.cwd(), "public/.htaccess");

/** Characters that mean something to Apache's regex engine. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * One redirect, anchored to the exact path.
 *
 * Anchoring matters. `Redirect` is a *prefix* match and appends whatever
 * follows the matched portion to the target, so
 * `Redirect 301 /chairs/rider-leather-chair /chairs/` sent
 * `/chairs/rider-leather-chair/` -- the trailing-slash form every internal
 * link used and the form Google indexed -- to `/chairs//`. Apache still served
 * that with a 200, which is why it went unnoticed, but a doubled slash is a
 * distinct URL to a crawler and splits exactly the signal a 301 exists to
 * consolidate. The prefix is loose in the other direction too: `/search` would
 * also have caught a hypothetical `/search-results`.
 *
 * These were `RedirectMatch` until the branded 404 needed a mod_rewrite
 * catch-all to reach the browser at all. The two modules cannot be mixed for
 * this, because mod_rewrite registers its fixup hook `APR_HOOK_FIRST` and
 * mod_alias registers `fixup_redir` `APR_HOOK_MIDDLE`: within one .htaccess,
 * every RewriteRule is therefore evaluated before any Redirect, whatever the
 * order they are written in. A catch-all for "no file here" would have
 * swallowed all 75 of these before mod_alias ever saw them, turning live 301s
 * into 404s invisibly -- the redirect targets still exist, so nothing in the
 * build would have failed. Expressed as RewriteRules they sit in one ordered
 * list with the catch-all last, and the ordering is the file's own.
 *
 * `^...$` matches the one path, with or without its trailing slash, and
 * appends nothing. The leading slash is dropped because per-directory
 * mod_rewrite matches the path relative to `RewriteBase`.
 */
function redirectLine(from: string, to: string): string {
  return `  RewriteRule ^${escapeRegex(from).replace(/^\\?\//, "")}/?$ ${to} [R=301,L]`;
}

function redirects(): string {
  const lines = allProducts.map((product) =>
    redirectLine(`/product/${product.id}`, product.href),
  );

  return lines.join("\n");
}

/**
 * Redirects for URLs the September 2026 range change removed.
 *
 * Emitted with their rationale as comments because a bare list of 301s is
 * unreadable a year later, and the question asked of it then will be "why
 * does this one point here", not "which ones exist".
 */
function legacyRedirects(): string {
  return LEGACY_REDIRECTS.map(({ from, to, note }) =>
    note
      ? `  # ${note}\n${redirectLine(from, to)}`
      : redirectLine(from, to),
  ).join("\n");
}

const body = `# GENERATED FILE -- edit scripts/generate-htaccess.ts, not this.
#
# Apache configuration for a Next.js static export on cPanel shared hosting.
#
# The previous version of this file rewrote every unmatched request to
# /index.html so React Router could handle routing in the browser. That must
# not survive: this build emits a real HTML file per route, and a catch-all
# would answer a missing stylesheet or image with a page of HTML, which the
# browser then fails to parse as CSS. Directory serving does the job instead.

# ---------------------------------------------------------------------------
# Error document
# ---------------------------------------------------------------------------
# Kept, but it is not what serves the 404 -- the catch-all at the foot of the
# rewrite rules is. This host swallows Apache's error handling whatever it is
# pointed at: with "ErrorDocument 404 /404.html" a dead URL returned GoDaddy's
# own grey "File not found" page, and pointing it at a PHP shim instead
# changed nothing, even though every other directive in this file demonstrably
# applies in production and /404.php requested directly returns the branded
# page with a 404. So the interception is of Apache's error machinery itself,
# and no target will satisfy it.
#
# It stays because it costs nothing, it is the correct declaration for any
# host that honours it, and it covers the cases the catch-all deliberately
# does not -- a 403 from "Options -Indexes", for instance, where the path does
# exist as a directory.
ErrorDocument 404 /404.php

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
</IfModule>

# ---------------------------------------------------------------------------
# HTTPS
# ---------------------------------------------------------------------------
# Deliberately not redirected here. TLS terminates at Cloudflare, and with the
# encryption mode set to Full the origin still sees plain HTTP on the back
# half of the connection -- so %{HTTPS} is "off" even when the visitor is on
# HTTPS. A redirect keyed on it would loop forever. "Always Use HTTPS" is set
# at the Cloudflare edge instead, which is the only place that can see the
# real scheme.

# ---------------------------------------------------------------------------
# Canonical host
# ---------------------------------------------------------------------------
# One hostname is canonical. Google treats apex and www as separate sites --
# separate rankings, separate favicons -- and right now both answer 200 with
# identical content, which splits the ranking signal between them. The apex is
# canonical: it is shorter, it is what gets printed on an invoice, and it is
# already the primary A record.
<IfModule mod_rewrite.c>
  RewriteCond %{HTTP_HOST} ^www\\.theheavencraft\\.in$ [NC]
  RewriteRule ^(.*)$ https://theheavencraft.in/$1 [R=301,L]
</IfModule>

# ---------------------------------------------------------------------------
# Directory index
# ---------------------------------------------------------------------------
# The export writes /chairs/index.html, so /chairs/ is served directly and
# mod_dir sends /chairs to /chairs/ with a 301.
DirectoryIndex index.html
DirectorySlash On
Options -Indexes

# ---------------------------------------------------------------------------
# Credentials
# ---------------------------------------------------------------------------
# The enquiry endpoint needs no secrets -- the local mail relay takes no
# authentication -- but if delivery ever moves to a provider's HTTPS API, the
# key belongs in a heavencraft-config.php created by hand in cPanel and never
# committed. Deny it outright so that a future misconfiguration which stopped
# PHP from executing could not serve that file as plain text.
<FilesMatch "^heavencraft-config\\.php$">
  Require all denied
</FilesMatch>

# ---------------------------------------------------------------------------
# Deploy bookkeeping
# ---------------------------------------------------------------------------
# The FTP deploy action leaves .ftp-deploy-sync-state.json in the document
# root and it was being served, 200, to anyone who asked. It is a complete
# inventory of the server: every file and directory, with a SHA-256 of each.
# That hands over the layout of the host, names paths that are not linked
# from anywhere, and lets an outsider diff two fetches to see exactly what
# changed in a release. The file has to stay where it is -- the action reads
# it back over FTP on the next run to work out the delta, and deleting it
# forces a full resync -- so it is denied over HTTP instead.
<FilesMatch "^\\.ftp-deploy-sync-state\\.json$">
  Require all denied
</FilesMatch>

# ---------------------------------------------------------------------------
# Legacy URLs from the React Router site
# ---------------------------------------------------------------------------
<IfModule mod_rewrite.c>
${redirects()}

  # Search was a client-side route with no server-rendered equivalent.
${redirectLine("/search", "/")}
</IfModule>

# ---------------------------------------------------------------------------
# URLs withdrawn by the September 2026 range change
# ---------------------------------------------------------------------------
# Products that were dropped, ranges that emptied, and products that survived
# under a new name -- a rename moves the URL, because the slug comes from the
# name. All of these were served with a 200 by this site and are in the index.
<IfModule mod_rewrite.c>
${legacyRedirects()}
</IfModule>

# ---------------------------------------------------------------------------
# Branded 404
# ---------------------------------------------------------------------------
# Must stay last: mod_rewrite stops at the first matching rule with [L], so
# every redirect above gets its chance before anything is treated as missing.
#
# This is an internal rewrite, not a redirect, so the browser keeps the dead
# URL in the address bar and the PHP shim sets the 404 itself -- which is the
# part this host does not intercept. Answering a missing page with a 200 would
# be worse than the grey default: Google calls that a soft 404 and can start
# distrusting URLs that do exist.
#
# The two conditions are what keep it from doing harm. A path that resolves to
# a real file or a real directory is left alone, so /chairs/ still serves
# its index, /enquiry.php still runs, and a hashed asset is still an asset.
# They also terminate the rewrite: the substitution is itself a real file, so
# the second pass matches nothing and the rule cannot loop.
<IfModule mod_rewrite.c>
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ /404.php [L]
</IfModule>

# ---------------------------------------------------------------------------
# Compression
# ---------------------------------------------------------------------------
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/css text/xml
  AddOutputFilterByType DEFLATE application/javascript application/json
  AddOutputFilterByType DEFLATE application/xml application/rss+xml
  AddOutputFilterByType DEFLATE image/svg+xml application/manifest+json
</IfModule>

# ---------------------------------------------------------------------------
# Caching
# ---------------------------------------------------------------------------
# Hashed build assets are immutable and cached for a year. Everything else is
# revalidated, because a deploy changes it in place under the same URL.
#
# The default is deliberately "revalidate", not "a month". It used to be the
# other way round -- long-lived by default, with exceptions listed -- and that
# silently caught Next's client-navigation payloads. The App Router fetches
# those as .txt beside each page, they hold the rendered page, and they change
# on every build; Next appends ?_rsc=<hash> to them, but that hash is derived
# from the route pattern rather than the build, so it is identical across
# builds and busts nothing. The result was a stable URL, changing content, and
# a 30-day cache: a returning visitor navigating between pages was served a
# month-old rendering, and once a deploy moved the chunk graph the payload
# referenced files that had been deleted, so the page failed to hydrate and
# only a reload fixed it. An opt-in list cannot have that failure mode -- a
# file type nobody thought about gets revalidated instead of frozen.
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresDefault "access plus 0 seconds"
  ExpiresByType text/html "access plus 0 seconds"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
</IfModule>

<IfModule mod_headers.c>
  # Documents: same URL, new bytes on every deploy. This must cover the
  # .txt navigation payloads as well as the pages themselves -- they are the
  # same content reached a different way, and caching one but not the other is
  # what lets a visitor see two different versions of the site at once.
  <FilesMatch "\\.(html|txt|xml|json)$">
    Header set Cache-Control "public, max-age=0, must-revalidate"
  </FilesMatch>

  <FilesMatch "^(favicon\\.ico|site\\.webmanifest)$">
    Header set Cache-Control "public, max-age=86400"
  </FilesMatch>

  # Fingerprinted by the build, so the URL changes whenever the bytes do.
  <FilesMatch "\\.(js|css|woff2)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>

  # ---- Security headers -------------------------------------------------
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Permissions-Policy "geolocation=(), microphone=(), camera=(), interest-cohort=()"
</IfModule>

# ---------------------------------------------------------------------------
# One-time cache purge
# ---------------------------------------------------------------------------
# Correcting the cache headers above stopped the damage but could not undo it.
# Until that fix shipped, the .txt navigation payloads went out with a 30-day
# max-age, so every browser that visited in the preceding month is still
# holding payloads it considers fresh -- and a fresh entry is served without
# asking the server anything, so those visitors never see the corrected
# headers at all. They keep navigating with a month-old payload that points at
# chunk files the next deploy deleted, and the page dies asking to be
# reloaded. Reloading does not help either: the stale entry is still fresh, so
# the next client-side navigation breaks again.
#
# Clear-Site-Data evicts it. "cache" only -- deliberately not "storage", which
# would take localStorage with it and throw away the visitor's Shopify cart
# id, and not "cookies", which would take the very cookie that stops this
# repeating. The cost is one slower page load while the images and fonts come
# back down.
#
# Gated on a cookie so it happens once per browser rather than on every page:
# the same response that clears the cache sets the marker, and every later
# request carries it. Cloudflare answers HTML with cf-cache-status DYNAMIC, so
# these per-visitor headers are never shared between two people.
#
# The counter in the cookie name is the lever: bumping it re-purges everyone.
# Safe to delete this whole block once the last 30-day payload has expired --
# after that it is pure cost, and the corrected headers hold on their own.
#
# Both halves sit inside the mod_setenvif test on purpose. Were the module
# missing, the gate could never close: "env=!hc_cache_purged" would hold for
# every request forever, and the site would throw its own cache away on every
# single page load. Nested, an absent module means the feature is simply not
# there, which is the safe way for it to fail.
<IfModule mod_setenvif.c>
  SetEnvIf Cookie "hc_cache_purge=1" hc_cache_purged

  <IfModule mod_headers.c>
    <FilesMatch "\\.html$">
      Header always set Clear-Site-Data "\\"cache\\"" env=!hc_cache_purged
      Header always set Set-Cookie "hc_cache_purge=1; Path=/; Max-Age=31536000; SameSite=Lax; Secure" env=!hc_cache_purged
    </FilesMatch>
  </IfModule>
</IfModule>

# ---------------------------------------------------------------------------
# MIME types
# ---------------------------------------------------------------------------
<IfModule mod_mime.c>
  AddType application/manifest+json .webmanifest
  AddType image/webp .webp
  AddType font/woff2 .woff2
</IfModule>

# ---------------------------------------------------------------------------
# Character set
# ---------------------------------------------------------------------------
# The host serves "Content-Type: text/html" with no charset. Browsers cope,
# because <meta charset> sits in the first 1024 bytes and HTML5 says to honour
# it. Link scrapers are less reliable, and the copy is full of characters that
# break loudly when guessed wrong: the em dashes in every og:image:alt, the
# ellipsis that ends most og:description values, and the rupee sign in the
# prices. A WhatsApp preview reading those as Latin-1 renders "â¦" and "â¹".
# Declaring it in the header removes the guess. Scoped to the text types so
# it cannot be appended to an image or font response.
<IfModule mod_mime.c>
  AddCharset utf-8 .html .css .js .json .xml .svg .webmanifest .txt
</IfModule>
AddDefaultCharset utf-8
`;

async function main() {
  await writeFile(OUT, body, "utf8");
  console.log(
    `wrote public/.htaccess with ${allProducts.length} product redirects ` +
      `and ${LEGACY_REDIRECTS.length} legacy redirects`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});