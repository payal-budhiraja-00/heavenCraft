/**
 * Installs the storefront redirect snippet into the live Shopify theme.
 *
 * ## Why a theme edit
 *
 * Publishing a product to the Online Store sales channel is what mints a
 * `checkoutUrl`, so the channel cannot be switched off without taking the cart
 * down with it. Shopify therefore always serves a second, fully browsable copy
 * of the catalogue at `shop.theheavencraft.in` -- duplicate content competing
 * with the real site in search, and the destination of the "Continue shopping"
 * button on the order status page, which non-Plus stores cannot retarget.
 *
 * Editing `layout/theme.liquid` is the one lever that covers every storefront
 * page at once. Checkout and the order status page do **not** render that
 * layout, so a payment in progress cannot be interrupted by it.
 *
 * ## Safety
 *
 * Every run writes the current remote file to `shopify-theme/backup/` before
 * touching anything, so a bad edit is one `--restore` away. The snippet is
 * delimited by marker comments and a re-run replaces the block between them
 * rather than stacking another copy.
 *
 * Usage:
 *   npm run shopify:redirect-apply                 # dry run, prints the diff
 *   npm run shopify:redirect-apply -- --live       # writes to the live theme
 *   npm run shopify:redirect-apply -- --live --remove   # takes the block out
 *   npm run shopify:redirect-apply -- --live --restore  # undoes the last write
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv, shopifyGraphql, type ShopifyEnv } from "./client";

const SNIPPET_PATH = resolve("shopify-theme/heavencraft-redirect.liquid");
const BACKUP_DIR = resolve("shopify-theme/backup");
const LAYOUT = "layout/theme.liquid";

const BEGIN = "{%- comment -%}BEGIN heavencraft-redirect{%- endcomment -%}";
const END = "{%- comment -%}END heavencraft-redirect{%- endcomment -%}";

const LIVE = process.argv.includes("--live");
const RESTORE = process.argv.includes("--restore");
const REMOVE = process.argv.includes("--remove");

type ThemeNode = { id: string; name: string; role: string };

async function publishedTheme(env: ShopifyEnv): Promise<ThemeNode> {
  const data = await shopifyGraphql<{
    themes: { nodes: ThemeNode[] };
  }>(
    env,
    `query { themes(first: 1, roles: [MAIN]) { nodes { id name role } } }`,
    {},
  );

  const theme = data.themes.nodes[0];
  if (!theme) throw new Error("No published (MAIN) theme found.");
  return theme;
}

async function readLayout(env: ShopifyEnv, themeId: string): Promise<string> {
  const data = await shopifyGraphql<{
    theme: {
      files: { nodes: { body: { content?: string } }[] };
    } | null;
  }>(
    env,
    `query ($id: ID!, $name: String!) {
       theme(id: $id) {
         files(filenames: [$name], first: 1) {
           nodes { body { ... on OnlineStoreThemeFileBodyText { content } } }
         }
       }
     }`,
    { id: themeId, name: LAYOUT },
  );

  const content = data.theme?.files.nodes[0]?.body?.content;
  if (typeof content !== "string") {
    throw new Error(`Could not read ${LAYOUT} from the theme.`);
  }
  return content;
}

async function writeLayout(
  env: ShopifyEnv,
  themeId: string,
  content: string,
): Promise<void> {
  const data = await shopifyGraphql<{
    themeFilesUpsert: {
      upsertedThemeFiles: { filename: string }[];
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    env,
    `mutation ($id: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
       themeFilesUpsert(themeId: $id, files: $files) {
         upsertedThemeFiles { filename }
         userErrors { field message }
       }
     }`,
    {
      id: themeId,
      files: [{ filename: LAYOUT, body: { type: "TEXT", value: content } }],
    },
  );

  const errors = data.themeFilesUpsert.userErrors;
  if (errors.length) {
    throw new Error(
      `themeFilesUpsert rejected the write:\n${errors
        .map((e) => `  ${e.field.join(".")}: ${e.message}`)
        .join("\n")}`,
    );
  }
}

/**
 * Splices the snippet in after the opening <head>. A previously installed
 * block is replaced in place so repeated runs stay idempotent.
 */
export function withSnippet(layout: string, snippet: string): string {
  const block = `${BEGIN}\n${snippet.trimEnd()}\n${END}\n`;

  const begin = layout.indexOf(BEGIN);
  if (begin !== -1) {
    const end = layout.indexOf(END);
    if (end === -1) {
      throw new Error(
        "Found a BEGIN marker with no END marker. Fix the theme by hand.",
      );
    }
    return layout.slice(0, begin) + block.trimEnd() + layout.slice(end + END.length);
  }

  const head = /<head[^>]*>/i.exec(layout);
  if (!head) throw new Error(`No <head> tag found in ${LAYOUT}.`);

  const at = head.index + head[0].length;
  return `${layout.slice(0, at)}\n${block}${layout.slice(at)}`;
}

/**
 * Takes the block back out, leaving the rest of the layout untouched. This is
 * the dependable uninstall: it keys off the markers in the file itself rather
 * than trusting that some backup on this machine is the right one.
 */
export function withoutSnippet(layout: string): string {
  const begin = layout.indexOf(BEGIN);
  if (begin === -1) return layout;

  const end = layout.indexOf(END);
  if (end === -1) {
    throw new Error(
      "Found a BEGIN marker with no END marker. Fix the theme by hand.",
    );
  }

  const after = layout.slice(end + END.length);

  /* The insert put a newline in front of BEGIN and left one behind END. Both
   * have to come back out, or every install/uninstall cycle leaves another
   * blank line in the layout. Verified byte-exact against the pristine file. */
  return (
    layout.slice(0, begin).replace(/\n[ \t]*$/, "") + after.replace(/^\n/, "")
  );
}

function saveBackup(content: string): string {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = resolve(BACKUP_DIR, `theme.liquid.${stamp}.bak`);
  writeFileSync(path, content, "utf8");
  return path;
}

function newestBackup(): string {
  const files = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("theme.liquid."))
    .sort();
  const last = files.at(-1);
  if (!last) throw new Error(`No backup found in ${BACKUP_DIR}.`);
  return resolve(BACKUP_DIR, last);
}

async function main() {
  const env = loadEnv();
  const theme = await publishedTheme(env);
  console.log(`Theme: ${theme.name} (${theme.role})`);

  const remote = await readLayout(env, theme.id);
  console.log(`Read ${LAYOUT} -- ${remote.length} bytes`);

  if (RESTORE) {
    const path = newestBackup();
    const content = readFileSync(path, "utf8");
    console.log(`Restoring from ${path} (${content.length} bytes)`);
    if (!LIVE) {
      console.log("\nDry run. Re-run with --live --restore to write.");
      return;
    }
    await writeLayout(env, theme.id, content);
    console.log("Restored.");
    return;
  }

  const backup = saveBackup(remote);
  console.log(`Backup written to ${backup}`);

  if (REMOVE) {
    const next = withoutSnippet(remote);
    if (next === remote) {
      console.log("No snippet block found. Nothing to remove.");
      return;
    }
    console.log(`Change: remove block (${remote.length} -> ${next.length} bytes)`);
    if (!LIVE) {
      console.log("\nDry run. Re-run with --live --remove to write.");
      return;
    }
    await writeLayout(env, theme.id, next);
    console.log(`Removed the block from ${LAYOUT}.`);
    return;
  }

  const snippet = readFileSync(SNIPPET_PATH, "utf8");
  const next = withSnippet(remote, snippet);

  if (next === remote) {
    console.log("Already up to date. Nothing to write.");
    return;
  }

  const action = remote.includes(BEGIN) ? "replace existing block" : "insert after <head>";
  console.log(`Change: ${action} (${remote.length} -> ${next.length} bytes)`);

  if (!LIVE) {
    console.log("\n--- first 40 lines of the new file ---");
    console.log(next.split("\n").slice(0, 40).join("\n"));
    console.log("\nDry run. Re-run with --live to write to the theme.");
    return;
  }

  await writeLayout(env, theme.id, next);
  console.log(`Wrote ${LAYOUT} to the live theme.`);
}

/* Only run when invoked directly. The splice helpers above are exported so
 * they can be tested without this file reaching for the network. */
if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
