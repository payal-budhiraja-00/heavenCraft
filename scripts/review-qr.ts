/**
 * Print-ready review QR codes, one per product plus a generic one.
 *
 * Run with `npm run review:qr`. Writes to ./review-qr, which is gitignored:
 * every byte is derived from the catalogue and REVIEW_LINK, so committing it
 * would be storing a build output and inviting it to drift from its source.
 *
 * Two formats, because the two uses want different things. SVG is what a
 * printer should be given -- it has no resolution to get wrong. PNG is for
 * everything that will not take a vector: WhatsApp, a slide, a label tool.
 *
 * The codes point at this site, never straight at Judge.me. A card in a
 * carton cannot be reissued, so routing through a URL we own is what keeps
 * the review provider a decision we can still change.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { allProducts } from "../src/lib/catalog";
import { REVIEW_LINK, absoluteUrl } from "../src/lib/site";

const OUT = path.join(process.cwd(), "review-qr");

/* Error correction M recovers ~15% of the code. On a card that will be
 * handled, folded and photographed at an angle, the margin is worth the
 * density it costs. */
const OPTIONS = { errorCorrectionLevel: "M" } as const;

/* Four modules of quiet zone, as the spec requires. A code trimmed flush to
 * its edge is the single most common reason a printed one will not scan:
 * without the margin a reader cannot find where the symbol begins. */
const MARGIN = 4;

/* 1200px is roughly 40mm at 600dpi -- larger than any of these will be
 * printed, so the printer scales down and never up. */
const PNG_WIDTH = 1200;

function fileSafe(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "");
}

async function write(name: string, url: string): Promise<void> {
  const svg = await QRCode.toString(url, {
    ...OPTIONS,
    type: "svg",
    margin: MARGIN,
  });
  await writeFile(path.join(OUT, `${name}.svg`), svg, "utf8");

  const png = await QRCode.toBuffer(url, {
    ...OPTIONS,
    type: "png",
    margin: MARGIN,
    width: PNG_WIDTH,
  });
  await writeFile(path.join(OUT, `${name}.png`), png);
}

async function main(): Promise<void> {
  if (!REVIEW_LINK) {
    throw new Error(
      "REVIEW_LINK is empty, so there is nothing to encode.\n" +
        "Paste the Judge.me review link into src/lib/site.ts first.",
    );
  }

  await mkdir(OUT, { recursive: true });

  /* The generic one asks which product was bought. It is the code for
   * invoices and box inserts, which cannot know what shipped in them. */
  await write("all-products", absoluteUrl("/review/"));

  const index: string[] = ["all-products.svg\t(asks which product)"];

  for (const product of allProducts) {
    const name = fileSafe(product.slug);
    /* Our own URL, which 301s to the product's Judge.me form. A scan lands on
     * the question itself rather than on a product page the customer has
     * already seen, and the redirect keeps the card working if the review
     * provider ever changes. */
    await write(name, absoluteUrl(`/review/${product.slug}/`));
    index.push(`${name}.svg\t${product.name}`);
  }

  await writeFile(
    path.join(OUT, "index.txt"),
    `${index.join("\n")}\n`,
    "utf8",
  );

  console.log(
    `Wrote ${allProducts.length + 1} QR codes (SVG + PNG) to review-qr/`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
