/**
 * Prints the compare-at prices this repo would seed into Shopify, without
 * touching Shopify. Run it before `set-compare-at.ts` to check the numbers.
 *
 *   npx tsx scripts/shopify/preview-compare-at.ts
 *
 * Output is deliberately ASCII-only. An earlier version drew box-rule
 * characters and the figures came back as mojibake through a Windows console,
 * which wasted a round of debugging on an encoding artefact rather than a
 * pricing question.
 */

import { allProducts } from "../../src/lib/catalog";
import {
  compareAtFor,
  MAX_PERCENT,
  MIN_PERCENT,
  type CompareAt,
} from "./pricing";

const inr = (paise: number) =>
  `Rs ${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

type Row = CompareAt & { name: string; group: string };

function main() {
  const rows: Row[] = [];

  for (const product of allProducts) {
    for (const variant of product.variants) {
      rows.push({
        ...compareAtFor(
          product.id,
          product.groupSlug,
          variant.id,
          variant.pricePaise,
        ),
        name:
          product.variants.length > 1
            ? `${product.name} - ${variant.colour}`
            : product.name,
        group: product.groupSlug,
      });
    }
  }

  rows.sort((a, b) => a.group.localeCompare(b.group) || a.pricePaise - b.pricePaise);

  let current = "";
  for (const row of rows) {
    if (row.group !== current) {
      current = row.group;
      console.log(`\n-- ${current.toUpperCase()} ${"-".repeat(56 - current.length)}`);
      console.log(
        `${"Product".padEnd(44)}${"Sells for".padStart(12)}${"MRP".padStart(12)}${"Off".padStart(7)}`,
      );
    }
    console.log(
      `${row.name.slice(0, 43).padEnd(44)}${inr(row.pricePaise).padStart(12)}${inr(
        row.comparePaise,
      ).padStart(12)}${`${row.percentOff}%`.padStart(7)}`,
    );
  }

  const percents = rows.map((r) => r.percentOff);
  const spread = new Map<number, number>();
  for (const p of percents) spread.set(p, (spread.get(p) ?? 0) + 1);

  console.log(`\n${"=".repeat(75)}`);
  console.log(`variants: ${rows.length}`);
  console.log(
    `discount range: ${Math.min(...percents)}% to ${Math.max(...percents)}%`,
  );
  console.log(
    `distinct values: ${spread.size} across ${rows.length} variants  ` +
      `[${[...spread.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([p, n]) => `${p}%x${n}`)
        .join("  ")}]`,
  );

  // Compared against the 258-listing Amazon/Flipkart sample, where 66% of
  // MRPs end in 99 and only 8% end in 00. A catalogue of round hundreds reads
  // as generated, which is the whole thing this is trying to avoid.
  const ends99 = rows.filter((r) => (r.comparePaise / 100) % 100 === 99).length;
  const ends00 = rows.filter((r) => (r.comparePaise / 100) % 100 === 0).length;
  console.log(
    `MRP ends in 99: ${Math.round((ends99 / rows.length) * 100)}% (market 66%)` +
      `   ends in 00: ${Math.round((ends00 / rows.length) * 100)}% (market 8%)`,
  );

  let failed = false;

  const outOfBand = rows.filter(
    (r) => r.percentOff < MIN_PERCENT || r.percentOff > MAX_PERCENT,
  );
  if (outOfBand.length) {
    console.log(
      `\nFAIL ${outOfBand.length} outside the ${MIN_PERCENT}-${MAX_PERCENT}% guard:`,
    );
    for (const r of outOfBand) console.log(`     ${r.sku} ${r.percentOff}%`);
    failed = true;
  } else {
    console.log(`ok   all within the ${MIN_PERCENT}-${MAX_PERCENT}% guard`);
  }

  // Two colourways of one chair at one price must not advertise two
  // different savings. This caught a real defect when the target was keyed
  // on the variant rather than the product.
  //
  // The check is on equal-priced variants only. The black footrest genuinely
  // costs more than the teak, so its discount landing a couple of points
  // apart is correct; what would be wrong is the same price showing two
  // different MRPs. A spread cap catches the case where differently priced
  // variants drift implausibly far apart.
  const priceMismatch: string[] = [];
  const wideSpread: string[] = [];

  for (const product of allProducts) {
    const byPrice = new Map<number, Set<number>>();
    const percents: number[] = [];

    for (const v of product.variants) {
      const r = compareAtFor(product.id, product.groupSlug, v.id, v.pricePaise);
      percents.push(r.percentOff);
      const seen = byPrice.get(v.pricePaise) ?? new Set<number>();
      seen.add(r.comparePaise);
      byPrice.set(v.pricePaise, seen);
    }

    for (const [price, mrps] of byPrice) {
      if (mrps.size > 1) {
        priceMismatch.push(
          `${product.id} @ ${inr(price)} -> ${[...mrps].map(inr).join(", ")}`,
        );
      }
    }

    if (Math.max(...percents) - Math.min(...percents) > 4) {
      wideSpread.push(
        `${product.id} ${Math.min(...percents)}%-${Math.max(...percents)}%`,
      );
    }
  }

  if (priceMismatch.length) {
    console.log(`\nFAIL equal-priced variants with different MRPs:`);
    for (const m of priceMismatch) console.log(`     ${m}`);
    failed = true;
  } else {
    console.log("ok   equal-priced variants always share one MRP");
  }

  if (wideSpread.length) {
    console.log(`\nFAIL discount spread within a product exceeds 4 points:`);
    for (const m of wideSpread) console.log(`     ${m}`);
    failed = true;
  } else {
    console.log("ok   discount spread within each product is within 4 points");
  }

  if (failed) process.exitCode = 1;
}

main();
