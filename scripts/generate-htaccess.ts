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

const OUT = path.join(process.cwd(), "public/.htaccess");

function redirects(): string {
  const lines = allProducts.map((product) => {
    const from = `/product/${product.id}`;
    return `  Redirect 301 ${from} ${product.href}`;
  });

  return lines.join("\n");
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

ErrorDocument 404 /404.html

# ---------------------------------------------------------------------------
# Legacy URLs from the React Router site
# ---------------------------------------------------------------------------
<IfModule mod_alias.c>
${redirects()}

  # Search was a client-side route with no server-rendered equivalent.
  Redirect 301 /search /
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
# Hashed build assets are immutable and cached for a year. HTML is revalidated
# every time, because a deploy changes it in place under the same URL.
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresDefault "access plus 1 month"
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
  <FilesMatch "\\.(html)$">
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
# MIME types
# ---------------------------------------------------------------------------
<IfModule mod_mime.c>
  AddType application/manifest+json .webmanifest
  AddType image/webp .webp
  AddType font/woff2 .woff2
</IfModule>
`;

async function main() {
  await writeFile(OUT, body, "utf8");
  console.log(
    `wrote public/.htaccess with ${allProducts.length} product redirects`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});