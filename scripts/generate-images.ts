/**
 * Pre-renders the responsive WebP derivatives that src/lib/image-loader.ts
 * points `next/image` at.
 *
 * Runs in `prebuild`, writing into `public/images/_opt/`, which is gitignored:
 * ~900 derivative files would dominate every diff and every clone, and they
 * are reproducible from the sources in one command.
 *
 * ## Sizing
 *
 * Sources are supplier exports between 699px and 1600px wide (median 1288).
 * Nothing is upscaled -- a request for a width above the source yields the
 * source width instead. That derivative still carries the ladder width in its
 * filename so the URL the loader computes always resolves; the only cost is
 * that the browser occasionally believes a candidate is slightly wider than it
 * is, which costs a little sharpness and never a 404.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { IMAGE_WIDTHS, imageKey } from "../src/lib/image-opt";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "public/images");
const OUT_DIR = path.join(SOURCE_DIR, "_opt");
const MANIFEST = path.join(OUT_DIR, "manifest.json");

const EXTENSIONS = new Set([".jpeg", ".jpg", ".png"]);

/**
 * 78 is where the WebP encoder stops producing visible gains on these
 * photographs -- above it the file grows faster than the quality does.
 */
const QUALITY = 78;

/** libvips threads internally, so a handful of concurrent encodes saturates. */
const CONCURRENCY = 6;

type Source = { absolute: string; publicPath: string; key: string };

async function collect(dir: string): Promise<Source[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: Source[] = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (absolute === OUT_DIR) continue;
      found.push(...(await collect(absolute)));
      continue;
    }
    if (!EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

    const publicPath = `/${path.relative(ROOT, absolute).split(path.sep).join("/").replace(/^public\//, "")}`;
    found.push({ absolute, publicPath, key: imageKey(publicPath) });
  }

  return found;
}

async function render(source: Source): Promise<number> {
  const image = sharp(source.absolute);
  const { width: sourceWidth } = await image.metadata();
  if (!sourceWidth) throw new Error(`could not read dimensions: ${source.publicPath}`);

  const sourceModified = (await stat(source.absolute)).mtimeMs;
  let written = 0;

  for (const target of IMAGE_WIDTHS) {
    const destination = path.join(OUT_DIR, `${source.key}-${target}.webp`);

    if (existsSync(destination) && (await stat(destination)).mtimeMs >= sourceModified) {
      continue;
    }

    await sharp(source.absolute)
      .resize({ width: Math.min(target, sourceWidth), withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(destination);
    written += 1;
  }

  return written;
}

/**
 * Deletes derivatives whose source no longer exists.
 *
 * Rendering is incremental -- it skips anything already newer than its source
 * -- so without this step the directory only ever grows. Retiring a product
 * would leave its photographs behind, and `out/` copies the whole directory,
 * so discontinued stock would be published at a guessable URL and counted
 * against the export budget forever.
 */
async function prune(liveKeys: Set<string>): Promise<number> {
  const entries = await readdir(OUT_DIR, { withFileTypes: true });
  let removed = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".webp")) continue;

    // "<key>-<width>.webp" -- split on the last dash so a key can never be
    // confused with the width suffix.
    const key = entry.name.slice(0, entry.name.lastIndexOf("-"));
    if (liveKeys.has(key)) continue;

    await rm(path.join(OUT_DIR, entry.name));
    removed += 1;
  }

  return removed;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const sources = await collect(SOURCE_DIR);

  // A collision would silently serve one product's photograph in place of
  // another's, so it fails the build instead.
  const byKey = new Map<string, string>();
  for (const source of sources) {
    const clash = byKey.get(source.key);
    if (clash) {
      throw new Error(`image key collision: ${clash} and ${source.publicPath} both hash to ${source.key}`);
    }
    byKey.set(source.key, source.publicPath);
  }

  let written = 0;
  const queue = [...sources];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    // Accumulated per worker and summed at the end. `written += await ...`
    // reads the counter before suspending and writes it after, so concurrent
    // workers would overwrite each other's increments.
    let mine = 0;
    for (let next = queue.pop(); next; next = queue.pop()) {
      mine += await render(next);
    }
    return mine;
  });
  written = (await Promise.all(workers)).reduce((sum, mine) => sum + mine, 0);

  // Read by verify-export.ts to prove every derivative the loader can ask for
  // actually shipped.
  await writeFile(
    MANIFEST,
    `${JSON.stringify(
      {
        widths: IMAGE_WIDTHS,
        images: Object.fromEntries([...byKey].map(([key, publicPath]) => [publicPath, key])),
      },
      null,
      2,
    )}\n`,
  );

  const expected = sources.length * IMAGE_WIDTHS.length;
  const removed = await prune(new Set(byKey.keys()));
  console.log(
    `images: ${sources.length} sources -> ${expected} derivatives ` +
      `(${written} rendered, ${expected - written} cached, ${removed} pruned)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
