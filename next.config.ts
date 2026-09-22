import type { NextConfig } from "next";
import { IMAGE_WIDTHS } from "./src/lib/image-opt";

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

  images: {
    // The default loader resizes on request and needs a server. This one maps
    // each width onto a WebP rendered ahead of the build by
    // scripts/generate-images.ts. The previous `unoptimized: true` disabled
    // srcset entirely, so a card shown at 400px pulled the full 1288px source.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",

    // Next concatenates imageSizes and deviceSizes into a single candidate
    // list, so these two must partition the ladder rather than overlap --
    // listing 384 in both put `384w` in every srcset twice. Together they are
    // exactly the set of widths the generator writes; a width Next asked for
    // that was never rendered would 404.
    deviceSizes: [...IMAGE_WIDTHS].slice(1),
    imageSizes: [IMAGE_WIDTHS[0]],
  },

  // A typed catalog is worth nothing if a broken build can still ship.
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;