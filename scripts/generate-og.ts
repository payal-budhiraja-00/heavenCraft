/**
 * Renders one Open Graph card per product, into `public/og/products/`.
 *
 * Runs in `prebuild`. The output is gitignored and reproducible, like the WebP
 * derivatives.
 *
 * ## Why these exist
 *
 * Product pages previously handed scrapers the raw gallery photograph. Those
 * are portrait -- every chair in this catalogue is between 0.53:1 and 0.74:1 --
 * and an Open Graph card is consumed at 1.91:1. WhatsApp, which is how most of
 * this audience shares a link, centre-crops to that ratio, so a 0.6:1 chair
 * arrives with its headrest and castors cut off: the exact failure the product
 * grid was just fixed for. Declaring no width or height made it worse, because
 * a scraper with no hint has to fetch and guess.
 *
 * ## Why there is no text on them
 *
 * `generate-icons.ts` renders type into the default card and is therefore run
 * by hand, because SVG text needs a font and CI has different fonts installed.
 * These run in `prebuild` on whatever machine deploys, so they have to be
 * reproducible without one. Everything here is pixel arithmetic.
 *
 * ## Composition
 *
 * The photograph is *contained*, never cropped -- containing a product on the
 * brand ground costs some black, cropping it costs the product. It sits in the
 * right-hand panel at full bleed height; the monogram holds the left. The
 * result is the site's own split, which is what the hero and the default card
 * already do.
 */

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { BASE, GOLD, monogram, ROOT } from "./lib/brand";
import products from "../src/data/products.json";

const OUT_DIR = path.join(ROOT, "public/og/products");

const W = 1200;
const H = 630;

/** The photograph's panel. Wide enough that a portrait frame still reads. */
const PANEL_W = 830;
const PANEL_PAD = 36;

type Product = { id: string; images: string[] };

/**
 * The card for one product: photograph framed in the right panel, monogram
 * centred in the remaining space.
 *
 * The photograph carries its own studio backdrop -- a tan sweep on most
 * chairs -- which meets the brand ground at a hard rectangle edge and reads
 * as a cutout pasted onto black. A gold hairline around it fixes that by
 * making the edge deliberate: a framed plate rather than a seam.
 */
async function card(imagePath: string, glyph: Buffer): Promise<Buffer> {
  const source = path.join(ROOT, "public", imagePath);

  const photo = await sharp(source)
    .resize(PANEL_W - PANEL_PAD * 2, H - PANEL_PAD * 2, {
      fit: "inside",
      withoutEnlargement: false,
    })
    .toBuffer();
  const { width: pw = 0, height: ph = 0 } = await sharp(photo).metadata();

  const frame = Buffer.from(
    `<svg width="${pw}" height="${ph}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="${pw - 1}" height="${ph - 1}"
            fill="none" stroke="${GOLD}" stroke-opacity="0.8" stroke-width="1"/>
    </svg>`,
  );

  const markSize = 132;
  const mark = await sharp(glyph)
    .resize(markSize, markSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  const panelLeft = W - PANEL_W;
  const photoLeft = panelLeft + Math.round((PANEL_W - pw) / 2);
  const photoTop = Math.round((H - ph) / 2);

  return sharp({
    create: { width: W, height: H, channels: 4, background: BASE },
  })
    .composite([
      { input: photo, left: photoLeft, top: photoTop },
      { input: frame, left: photoLeft, top: photoTop },
      {
        input: mark,
        left: Math.round((panelLeft - markSize) / 2),
        top: Math.round((H - markSize) / 2),
      },
    ])
    .jpeg({ quality: 86, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const glyph = await monogram();
  const live = new Set<string>();
  let written = 0;
  let bytes = 0;

  for (const product of products as Product[]) {
    const lead = product.images[0];
    if (!lead) continue;

    const name = `${product.id}.jpg`;
    const data = await card(lead, glyph);
    await writeFile(path.join(OUT_DIR, name), data);

    live.add(name);
    written += 1;
    bytes += data.length;
  }

  // Retiring a product must not leave its card published at a guessable URL.
  let removed = 0;
  for (const entry of await readdir(OUT_DIR)) {
    if (live.has(entry)) continue;
    await rm(path.join(OUT_DIR, entry));
    removed += 1;
  }

  const average = written ? Math.round(bytes / written / 1024) : 0;
  console.log(
    `og: ${written} product cards at ${W}x${H} (avg ${average} kB, ${removed} pruned)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
