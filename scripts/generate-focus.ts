import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

import products from "../src/data/products.json";

/**
 * Works out, for each photograph, where the furniture actually sits inside the
 * frame, and records it as a CSS `object-position`.
 *
 * ## Why
 *
 * Every surface on the site crops its photograph to fill a fixed box. The
 * default crop is the middle of the image, which is the one place the supplier
 * did not reliably put the product: the chairs are shot tall with a lot of
 * empty backdrop above the headrest, so a centre crop into a landscape tile
 * cut the chair off at the arms and showed mostly floor.
 *
 * The previous answer was to letterbox the photograph and hide the bars behind
 * a blurred copy of itself. That kept every pixel but read as a mistake.
 *
 * This instead keeps `object-fit: cover` -- a full-bleed, undivided photograph
 * -- and moves the crop window over the product. Nothing is scaled down and no
 * bars are ever drawn.
 *
 * ## How the product is found
 *
 * Studio frames are shot on a seamless backdrop, so the border ring of the
 * image is background by construction. The median of that ring is taken as the
 * backdrop colour, every pixel far enough from it is marked as subject, and
 * the bounding box of those pixels is the product.
 *
 * Lifestyle frames have no seamless backdrop, so that test marks almost the
 * whole frame as subject. That is the signal used to detect them: above
 * `BUSY_COVERAGE` the image is treated as a scene rather than a cut-out and
 * left centred, which is what a room shot wants anyway.
 *
 * Analysis runs on a thumbnail. A focal point is only ever expressed as a
 * percentage, so the extra precision of the full-size file would be discarded.
 */

/** Width the image is analysed at. Enough to locate a chair, cheap to decode. */
const SAMPLE_WIDTH = 72;

/**
 * How far a pixel must sit from the backdrop colour to count as subject,
 * as a 0-255 per-channel distance.
 *
 * Low enough to catch a white chair on a near-white backdrop; high enough to
 * ignore the soft shadow under the castors and JPEG noise in flat areas.
 */
const SUBJECT_THRESHOLD = 26;

/**
 * Subject coverage above which the frame is taken to be a scene, not a
 * cut-out, and is left centred.
 */
const BUSY_COVERAGE = 0.82;

/**
 * Subject coverage below which the detection is taken to have failed -- a
 * handful of stray pixels, usually a watermark -- and is left centred.
 */
const EMPTY_COVERAGE = 0.012;

/**
 * How far the focal point may travel from the centre, as a fraction.
 *
 * A focal point is a hint, not an instruction. Clamping keeps one
 * mis-detection from pinning a crop to the very edge of a frame, which is far
 * more conspicuous than a slightly off-centre product.
 */
const MAX_SHIFT = 0.3;

const PUBLIC_DIR = join(process.cwd(), "public");
const OUT_FILE = join(process.cwd(), "src", "data", "image-focus.json");

type Raw = { data: Buffer; info: sharp.OutputInfo };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1] ?? 0;
}

/** Median colour of the one-pixel ring around the frame. */
function borderColour({ data, info }: Raw): [number, number, number] {
  const { width, height, channels } = info;
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];

  const sample = (x: number, y: number) => {
    const at = (y * width + x) * channels;
    reds.push(data[at] ?? 0);
    greens.push(data[at + 1] ?? 0);
    blues.push(data[at + 2] ?? 0);
  };

  for (let x = 0; x < width; x += 1) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    sample(0, y);
    sample(width - 1, y);
  }

  return [median(reds), median(greens), median(blues)];
}

type Focus = { position: string; coverage: number; reason: string };

/** What is recorded per image. `pos` is omitted when the frame is centred. */
type Entry = { ar: number; pos?: string };

function analyse(raw: Raw): Focus {
  const { data, info } = raw;
  const { width, height, channels } = info;
  const [br, bg, bb] = borderColour(raw);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let subjectPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * channels;
      const distance = Math.max(
        Math.abs((data[at] ?? 0) - br),
        Math.abs((data[at + 1] ?? 0) - bg),
        Math.abs((data[at + 2] ?? 0) - bb),
      );

      if (distance <= SUBJECT_THRESHOLD) continue;

      subjectPixels += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const coverage = subjectPixels / (width * height);

  if (coverage >= BUSY_COVERAGE) {
    return { position: "50% 50%", coverage, reason: "scene" };
  }
  if (coverage <= EMPTY_COVERAGE || maxX < 0) {
    return { position: "50% 50%", coverage, reason: "no-subject" };
  }

  const clamp = (value: number) =>
    Math.min(0.5 + MAX_SHIFT, Math.max(0.5 - MAX_SHIFT, value));

  const x = clamp((minX + maxX + 1) / 2 / width);
  const y = clamp((minY + maxY + 1) / 2 / height);

  const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;

  return { position: `${percent(x)} ${percent(y)}`, coverage, reason: "subject" };
}

function imagePaths(): string[] {
  const seen = new Set<string>();

  for (const product of products as Array<{
    images?: string[];
    variants?: Array<{ images?: string[] }>;
  }>) {
    for (const src of product.images ?? []) seen.add(src);
    for (const variant of product.variants ?? []) {
      for (const src of variant.images ?? []) seen.add(src);
    }
  }

  return [...seen].sort();
}

async function main() {
  const paths = imagePaths();
  const manifest: Record<string, Entry> = {};
  const tally = { subject: 0, scene: 0, "no-subject": 0, missing: 0 };

  for (const src of paths) {
    const file = join(PUBLIC_DIR, ...src.split("/"));

    let raw: Raw;
    try {
      raw = await sharp(readFileSync(file))
        .resize({ width: SAMPLE_WIDTH, fit: "inside" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    } catch {
      tally.missing += 1;
      continue;
    }

    const result = analyse(raw);
    tally[result.reason as keyof typeof tally] += 1;

    // The thumbnail preserves the ratio, so it can be measured here rather
    // than decoding the full-size file a second time.
    const entry: Entry = {
      ar: Math.round((raw.info.width / raw.info.height) * 100) / 100,
    };

    // Only off-centre points are recorded. The stylesheet already centres, so
    // storing "50% 50%" would be several kilobytes saying nothing.
    if (result.position !== "50% 50%") entry.pos = result.position;

    manifest[src] = entry;
  }

  const body = `${JSON.stringify(manifest, null, 2)}\n`;
  const digest = createHash("sha256").update(body).digest("hex").slice(0, 8);

  writeFileSync(OUT_FILE, body);

  const offCentre = Object.values(manifest).filter((e) => e.pos).length;

  console.log(
    `focus: ${paths.length} images -> ${offCentre} off-centre ` +
      `(subject ${tally.subject}, scene ${tally.scene}, ` +
      `none ${tally["no-subject"]}, missing ${tally.missing}) [${digest}]`,
  );

  if (tally.missing > 0) {
    throw new Error(`${tally.missing} referenced image(s) could not be read`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
