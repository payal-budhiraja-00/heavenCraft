/**
 * Proves that installing the redirect block into layout/theme.liquid and
 * taking it out again returns the file byte for byte.
 *
 * This matters because the install and the uninstall are separate pieces of
 * string surgery, and an asymmetry between them is invisible: it shows up as
 * one extra blank line per cycle, quietly accumulating in a live theme. An
 * earlier version of `withoutSnippet` did exactly that.
 *
 * The real functions are imported rather than copied, so this cannot pass
 * while the shipped code is broken.
 *
 * Run: npm run shopify:redirect-verify
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { withSnippet, withoutSnippet } from "./apply-redirect-snippet";

const BEGIN = "{%- comment -%}BEGIN heavencraft-redirect{%- endcomment -%}";

const original = readFileSync(
  resolve("shopify-theme/theme.liquid.original.bak"),
  "utf8",
);
const snippet = readFileSync(
  resolve("shopify-theme/heavencraft-redirect.liquid"),
  "utf8",
);

const once = withSnippet(original, snippet);
const back = withoutSnippet(once);
const twice = withSnippet(once, snippet);

let failed = false;
function check(label: string, ok: boolean, detail = "") {
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` -- ${detail}` : ""}`,
  );
  if (!ok) failed = true;
}

const occurrences = (haystack: string) =>
  haystack.split(BEGIN).length - 1;

check(
  "install adds the block",
  once.includes(BEGIN) && once.length > original.length,
  `${original.length} -> ${once.length} bytes`,
);
check(
  "uninstall returns the original byte for byte",
  back === original,
  back === original ? "" : `expected ${original.length}, got ${back.length}`,
);
check("re-install does not stack a second copy", occurrences(twice) === 1);
check("uninstall after a re-install is also exact", withoutSnippet(twice) === original);
check(
  "the guard that protects checkout survives the round trip",
  /if \(\/\^\\\/\(cart\|checkouts\?\|/.test(once),
);

process.exit(failed ? 1 : 0);
