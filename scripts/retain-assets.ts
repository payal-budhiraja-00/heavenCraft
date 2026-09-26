/**
 * Keeps recently-deleted build assets on the server.
 *
 * Next fingerprints everything under `_next/static`, so a deploy writes new
 * chunk filenames and the old ones stop being referenced by the pages it
 * uploads. The FTP action then deletes them, because they are no longer in
 * `out/`. That is correct for the pages being served and wrong for the
 * browsers that are not being served them: a visitor holding a cached
 * navigation payload still asks for the old filenames, gets a 404, and the
 * page dies asking to be reloaded.
 *
 * It is invisible for a while because Cloudflare caches those files for a
 * year and keeps answering 200 after the origin has dropped them, so the
 * failure only surfaces once an edge evicts -- which makes it look random and
 * unreproducible, and is exactly how it was reported.
 *
 * Corrected cache headers stop new payloads going stale, but a payload cached
 * before that fix stays authoritative in the browser for its full month. This
 * covers that tail, and any future case where a client is a build behind: the
 * files a recent build published are carried forward into `out/` so the
 * deploy leaves them in place instead of removing them.
 *
 * History lives in the Actions cache between runs. Losing it is not harmful
 * -- the next run simply starts a fresh window -- so it is restored with a
 * prefix key and never required to exist.
 */

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "out");
const HISTORY = path.join(process.cwd(), ".asset-history");
const HISTORY_FILES = path.join(HISTORY, "files");
const MANIFEST = path.join(HISTORY, "manifest.json");

/**
 * How long a retired asset is kept.
 *
 * Matched to the month-long max-age that the stale payloads were served with,
 * because that is how long a browser can go on believing one of them without
 * ever contacting the server.
 */
const RETENTION_DAYS = 35;

/** Only fingerprinted output is safe to keep: same name always means same bytes. */
const TRACKED = "_next/static";

type Manifest = { files: Record<string, string> };

async function walk(dir: string, base: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const found: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full, base)));
    else found.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return found;
}

async function readManifest(): Promise<Manifest> {
  try {
    const parsed: unknown = JSON.parse(await readFile(MANIFEST, "utf8"));
    if (parsed && typeof parsed === "object" && "files" in parsed) {
      const files = (parsed as Manifest).files;
      if (files && typeof files === "object") return { files };
    }
  } catch {
    // No history yet, or it was evicted. Start a new window.
  }
  return { files: {} };
}

async function main() {
  const current = new Set(await walk(path.join(OUT, TRACKED), OUT));
  if (current.size === 0) {
    throw new Error(
      `No files under out/${TRACKED}. Run this after the build, not before.`,
    );
  }

  const history = await readManifest();
  const today = new Date();
  const cutoff = new Date(today.getTime() - RETENTION_DAYS * 86_400_000);
  const stamp = today.toISOString();

  const next: Record<string, string> = {};
  let restored = 0;
  let expired = 0;

  for (const [rel, firstSeen] of Object.entries(history.files)) {
    if (current.has(rel)) continue;

    const seen = new Date(firstSeen);
    if (Number.isNaN(seen.getTime()) || seen < cutoff) {
      expired++;
      continue;
    }

    const from = path.join(HISTORY_FILES, rel);
    try {
      await stat(from);
    } catch {
      // Recorded but not stored -- treat as gone rather than failing the deploy.
      continue;
    }

    const to = path.join(OUT, rel);
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to);
    next[rel] = firstSeen;
    restored++;
  }

  for (const rel of current) next[rel] = history.files[rel] ?? stamp;

  // Rebuild the store from out/, which now holds this build plus everything
  // carried forward, so the two can never disagree about what is retained.
  await rm(HISTORY_FILES, { recursive: true, force: true });
  for (const rel of Object.keys(next)) {
    const to = path.join(HISTORY_FILES, rel);
    await mkdir(path.dirname(to), { recursive: true });
    await cp(path.join(OUT, rel), to);
  }
  await mkdir(HISTORY, { recursive: true });
  await writeFile(MANIFEST, JSON.stringify({ files: next }, null, 2), "utf8");

  console.log(
    `retained ${restored} asset(s) from earlier builds, ` +
      `dropped ${expired} past ${RETENTION_DAYS} days, ` +
      `tracking ${Object.keys(next).length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
