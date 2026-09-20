import type { NextConfig } from "next";

/**
 * Static export. The host is a GoDaddy cPanel account behind Cloudflare --
 * Apache serving files, with no Node runtime available. Every route below is
 * therefore emitted as real HTML at build time.
 */
const nextConfig: NextConfig = {
  output: "export",

  // Apache serves /chairs/ from /chairs/index.html. Without this, exported
  // routes land at /chairs.html and directory URLs 404.
  trailingSlash: true,

  // The default image loader needs a server to resize on request. Sizes are
  // pre-generated at build time instead.
  images: { unoptimized: true },

  // A typed catalog is worth nothing if a broken build can still ship.
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;