/**
 * Writes the Shopify product import CSV, and a companion sheet for the fields
 * only the owner can supply.
 *
 * Run with `npm run shopify:csv`. Needs no credentials -- this is the path
 * that works if the Admin API route is ever unavailable, and it is also the
 * artefact to read before letting `shopify:sync` write anything.
 *
 * ## On the header row
 *
 * Shopify's importer accepts a subset of columns and ignores what it does not
 * recognise, so this writes the long-stable core rather than every column a
 * modern export emits. The volatile ones are left out on purpose:
 * `Product Category` wants a Shopify taxonomy ID that differs per store, and
 * the `Included / <country>` and `Price / <country>` columns only exist once
 * Markets is configured. Both are better set in the admin after import than
 * guessed at here.
 *
 * Weight and HS code are intentionally blank -- see owner-input.csv.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCatalog, type ShopifyProduct } from "./payload";

const OUT_DIR = path.join(process.cwd(), "docs/shopify");
const IMPORT_CSV = path.join(OUT_DIR, "products-import.csv");
const OWNER_CSV = path.join(OUT_DIR, "owner-input.csv");

const COLUMNS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Variant SKU",
  "Variant Grams",
  "Variant Inventory Tracker",
  "Variant Inventory Qty",
  "Variant Inventory Policy",
  "Variant Fulfillment Service",
  "Variant Price",
  "Variant Requires Shipping",
  "Variant Taxable",
  "Variant Weight Unit",
  "Image Src",
  "Image Position",
  "Image Alt Text",
  "SEO Title",
  "SEO Description",
  "Status",
] as const;

type Column = (typeof COLUMNS)[number];
type Row = Partial<Record<Column, string>>;

/** RFC 4180: quote when the value contains a comma, quote or newline. */
function escapeCell(value: string): string {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(columns: readonly string[], rows: Record<string, string>[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(row[c] ?? "")).join(","));
  }
  // Trailing newline: some spreadsheet tools drop the final row without it.
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * The first row of a product carries every field. Each additional colourway
 * is a row bearing the handle, its option value and its own variant columns;
 * each additional image is a row bearing only the handle and image columns.
 * That is Shopify's format, not a shortcut.
 */
function rowsFor(product: ShopifyProduct): Row[] {
  const [lead, ...rest] = product.images;
  const [first, ...others] = product.variants;
  if (!first) throw new Error(`${product.handle} has no variants`);

  const variantCells = (variant: ShopifyProduct["variants"][number]): Row => ({
    "Option1 Value": variant.colour,
    "Variant SKU": variant.sku,
    "Variant Grams": "",
    // Blank tracker means Shopify does not count stock. Deliberate: this is a
    // reseller ordering in on demand, and a tracked variant at zero blocks
    // checkout on a product that is perfectly available.
    "Variant Inventory Tracker": "",
    "Variant Inventory Qty": "",
    "Variant Inventory Policy": "continue",
    "Variant Fulfillment Service": "manual",
    "Variant Price": variant.price,
    "Variant Requires Shipping": "TRUE",
    "Variant Taxable": "TRUE",
    "Variant Weight Unit": "kg",
  });

  const head: Row = {
    Handle: product.handle,
    Title: product.title,
    "Body (HTML)": product.bodyHtml,
    Vendor: product.vendor,
    Type: product.productType,
    Tags: product.tags.join(", "),
    Published: "TRUE",
    // Every product declares a Colour option, including the single-finish
    // ones. Shopify's own default is "Title / Default Title", which shows up
    // on the order line and tells the person packing it nothing.
    "Option1 Name": "Colour",
    ...variantCells(first),
    "SEO Title": product.seoTitle,
    "SEO Description": product.seoDescription,
    Status: "active",
  };

  if (lead) {
    head["Image Src"] = lead.src;
    head["Image Position"] = String(lead.position);
    head["Image Alt Text"] = lead.altText;
  }

  const moreVariants: Row[] = others.map((variant) => ({
    Handle: product.handle,
    ...variantCells(variant),
  }));

  const extra: Row[] = rest.map((image) => ({
    Handle: product.handle,
    "Image Src": image.src,
    "Image Position": String(image.position),
    "Image Alt Text": image.altText,
  }));

  return [head, ...moreVariants, ...extra];
}

/**
 * The sheet only the owner can fill.
 *
 * Ordered deliberately: reference columns first so a row is identifiable, then
 * the fields that block shipping and invoicing, then the ones that only make
 * the listing better. Rows are grouped by category because HSN, GST, warranty
 * and origin are in practice identical across a category -- fill the first row
 * of each group and drag down rather than typing 34 times.
 */
const OWNER_COLUMNS = [
  "Handle",
  "Category",
  "Title",
  "Colour",
  "Variant SKU",
  "Price (INR)",
  "HSN code",
  "GST rate %",
  "Country of origin",
  "Boxed weight (kg)",
  "Box length (cm)",
  "Box width (cm)",
  "Box height (cm)",
  "Net weight (kg)",
  "Warranty (months)",
  "Max user weight (kg)",
  "Assembly required (Yes/No)",
] as const;

async function main() {
  const products = buildCatalog();

  const importRows = products.flatMap(rowsFor) as Record<string, string>[];
  await writeFile(IMPORT_CSV, toCsv(COLUMNS, importRows), "utf8");

  /* One row per colourway rather than per product. The SKU is what an order
   * line records, and the fields being asked for are not all constant across
   * a product: a marble-topped table and a teak one do not weigh the same,
   * and the footrest's three finishes are three different prices. */
  const ownerRows = products
    .flatMap((p) => p.variants.map((variant) => ({ product: p, variant })))
    .sort(
      (a, b) =>
        a.product.productType.localeCompare(b.product.productType) ||
        a.product.title.localeCompare(b.product.title) ||
        a.variant.colour.localeCompare(b.variant.colour),
    )
    .map(({ product, variant }) => ({
      Handle: product.handle,
      Category: product.productType,
      Title: product.title,
      Colour: variant.colour,
      "Variant SKU": variant.sku,
      "Price (INR)": variant.price,
      /* Every fillable column is left blank on purpose. Country of origin in
       * particular is a customs declaration -- most ergonomic seating sold in
       * India is imported, and a wrong value is the owner's legal exposure,
       * not something to guess at helpfully. */
      "Country of origin": "",
    })) as Record<string, string>[];
  await writeFile(OWNER_CSV, toCsv(OWNER_COLUMNS, ownerRows), "utf8");

  const images = products.reduce((n, p) => n + p.images.length, 0);
  console.log(`shopify csv: ${products.length} products, ${images} images, ${importRows.length} rows`);
  console.log(`  -> ${path.relative(process.cwd(), IMPORT_CSV)}`);
  console.log(`  -> ${path.relative(process.cwd(), OWNER_CSV)}  (see owner-input.md)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
