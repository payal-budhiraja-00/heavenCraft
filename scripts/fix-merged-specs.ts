/**
 * One-shot data repair for two products whose specification tables did not
 * describe the thing on the page.
 *
 * The footrest listing sells three finishes that are not one product in three
 * colours: black is an adjustable plastic wedge, wooden and marble are fixed
 * boards, and the supplier measured each separately. Those three sheets had
 * been concatenated into one ten-row table with the product name prefixed onto
 * every label, so whichever finish you picked, half the rows were about the
 * other one. The fix moves each sheet onto its own variant.
 *
 * The cup holder had picked up two rows from somewhere other than its
 * dimension sheet. One was redundant -- "Compatible diameter up to 8.5 cm"
 * restates the 3.6 in inner diameter and is already said in the feature list.
 * The other exposed a contradiction between two supplier sheets: the dimension
 * sheet prints "Adjustable Table Thickness 0 - 2.5 in" (0 - 6.35 cm) while the
 * features sheet prints "desk thickness 1.5 - 5 cm". Both are the supplier's
 * own artwork and there is no way to tell which is right from here, so the
 * table publishes the range both sheets agree on -- 1.5 - 5 cm -- which is the
 * claim least likely to put a customer's desk outside what they bought. The
 * discrepancy is worth a question to the supplier.
 *
 * Run once: npx tsx scripts/fix-merged-specs.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Spec = { label: string; value: string };
type Variant = {
  colourSlug: string;
  specifications?: Spec[];
  [k: string]: unknown;
};
type Product = {
  name: string;
  specifications?: Spec[];
  variants?: Variant[];
  [k: string]: unknown;
};

const FILE = join(process.cwd(), "src", "data", "products.json");

/** Transcribed from each finish's own dimension sheet (image 3 of 4). */
const FOOTREST: Record<string, Spec[]> = {
  black: [
    { label: "Width", value: "17 in" },
    { label: "Depth", value: "12 in" },
    { label: "Front height", value: "7.5 in" },
    { label: "Rear height", value: "3 in" },
    { label: "Height range", value: "3 in – 7.5 in (front to rear slope)" },
  ],
  "wooden-teak": [
    { label: "Width", value: "18 in" },
    { label: "Depth", value: "12 in" },
    { label: "Front height", value: "5 in" },
    { label: "Rear height", value: "3 in" },
    { label: "Height range", value: "3 in – 5 in (front to rear slope)" },
  ],
  "black-marble": [
    { label: "Width", value: "18 in" },
    { label: "Depth", value: "12 in" },
    { label: "Front height", value: "5 in" },
    { label: "Rear height", value: "3 in" },
    { label: "Height range", value: "3 in – 5 in (front to rear slope)" },
  ],
};

/** The four rows the cup holder's sheet actually prints. */
const CUP_HOLDER_KEEP = new Set([
  "Adjustable Table Thickness",
  "Outer Diameter",
  "Inner Diameter",
  "Height",
]);

const source = readFileSync(FILE, "utf8");
const eol = source.includes("\r\n") ? "\r\n" : "\n";
const products = JSON.parse(source) as Product[];

let changed = 0;

const footrest = products.find((p) => p.name === "Footrest");
if (!footrest) throw new Error("Footrest not found");
if (!footrest.variants?.length) throw new Error("Footrest has no variants");

for (const variant of footrest.variants) {
  const specs = FOOTREST[variant.colourSlug];
  if (!specs) {
    throw new Error(`No transcribed sheet for footrest finish "${variant.colourSlug}"`);
  }
  variant.specifications = specs;
  changed += 1;
}
// Every row was finish-specific, so nothing survives at product level.
footrest.specifications = [];

const cupHolder = products.find((p) => p.name === "Cup Holder");
if (!cupHolder) throw new Error("Cup Holder not found");
const before = cupHolder.specifications?.length ?? 0;
cupHolder.specifications = (cupHolder.specifications ?? []).filter((s) =>
  CUP_HOLDER_KEEP.has(s.label),
);
const dropped = before - cupHolder.specifications.length;
if (cupHolder.specifications.length !== CUP_HOLDER_KEEP.size) {
  throw new Error(
    `Cup Holder should keep ${CUP_HOLDER_KEEP.size} rows, kept ${cupHolder.specifications.length}`,
  );
}

const thickness = cupHolder.specifications.find(
  (s) => s.label === "Adjustable Table Thickness",
);
if (!thickness) throw new Error("Cup Holder thickness row missing");
thickness.value = "1.5 – 5 cm (approx. 0.6 – 2 in)";

const out = JSON.stringify(products, null, 2).split("\n").join(eol) + eol;
writeFileSync(FILE, out, "utf8");

console.log(`Footrest: split merged table across ${changed} finishes.`);
console.log(`Cup Holder: dropped ${dropped} contradictory rows.`);
