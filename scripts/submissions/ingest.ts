import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

import sharp from "sharp";

import { GROUP_OF, slugify } from "../../src/lib/catalog";

/**
 * Pulls product submissions off the host and turns them into catalogue
 * entries.
 *
 * ## Why this talks HTTP and not FTP
 *
 * The obvious transport was the FTP account the deploy already uses. It does
 * not work. submit-product.php parks drafts outside the document root where
 * the host allows it and inside it where the account is confined to
 * public_html, so the directory this script needs to read is wherever the PHP
 * happened to land -- and on a chrooted account the preferred location is not
 * reachable over FTP at all. The PHP always knows where it put them, so the
 * collection goes back through the same endpoint.
 *
 * ## Why a second key
 *
 * `collect_key` is not `submit_key`. The submit key is given to suppliers and
 * typed into a phone in a showroom; it will leak eventually, and all it can
 * do is add a draft. The collect key can read every submission the shop has
 * ever received, so it exists only in this repository's Actions secrets.
 *
 * ## What it deliberately does not do
 *
 * It does not mark anything collected. That is `submissions:done`, run only
 * after the branch is pushed, so a job that dies halfway leaves the client's
 * photographs on the host to be fetched again rather than dropping them.
 */

const ENDPOINT = process.env.SUBMIT_ENDPOINT ?? "";
const COLLECT_KEY = process.env.SUBMIT_COLLECT_KEY ?? "";

const ROOT = join(import.meta.dirname, "..", "..");
const PRODUCTS = join(ROOT, "src", "data", "products.json");
const IMAGES = join(ROOT, "public", "images", "products");

/** Written for `submissions:done` and for the workflow to read. Not committed. */
const RECEIPT = join(ROOT, "submissions-ingested.json");

/**
 * The pull request description, written here rather than assembled in YAML so
 * that it is typechecked and can be read without decoding shell quoting.
 * Not committed.
 */
const PR_BODY = join(ROOT, "submissions-pr-body.md");

type Feature = { title: string; detail?: string };
type Spec = { label: string; value: string };

type SubmittedVariant = { colour: string; images: string[] };

type Submitted = {
  name: string;
  shortName?: string;
  category: string;
  subCategory: string;
  subName?: string;
  description: string;
  price: number;
  mrp?: number;
  inStock?: boolean;
  features: Feature[];
  specifications: Spec[];
  materials?: string[];
  inTheBox?: string[];
  variants: SubmittedVariant[];
};

type Draft = { id: string; receivedAt: string; product: Submitted };

type RawVariant = {
  id: string;
  colour: string;
  colourSlug: string;
  price: number;
  images: string[];
  inStock?: boolean;
};

type RawProduct = {
  id: string;
  name: string;
  shortName?: string;
  category: string;
  subCategory: string;
  subName?: string;
  price: number;
  mrp?: number;
  currency: string;
  description: string;
  features?: Feature[];
  specifications?: Spec[];
  materials?: string[];
  inTheBox?: string[];
  images?: string[];
  inStock?: boolean;
  variants?: RawVariant[];
};

async function call(
  action: string,
  extra: Record<string, string> = {},
): Promise<Response> {
  const body = new FormData();
  body.set("action", action);
  body.set("collect_key", COLLECT_KEY);
  for (const [key, value] of Object.entries(extra)) body.set(key, value);

  const res = await fetch(ENDPOINT, { method: "POST", body });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${action} failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
  }
  return res;
}

async function list(): Promise<Draft[]> {
  const res = await call("list");
  const payload = (await res.json()) as { ok?: boolean; drafts?: Draft[] };
  if (!payload.ok) throw new Error("list did not succeed");
  return payload.drafts ?? [];
}

/**
 * Writes one photograph into the repository.
 *
 * Everything lands as .jpeg because that is the only extension the catalogue
 * uses and image-opt keys its derivatives off the source path. A JPEG is
 * copied through byte for byte rather than re-encoded -- the browser already
 * compressed it once at 0.85, and a second pass would soften the mesh
 * patterns for nothing. Only PNG and WebP are converted.
 */
async function writeImage(bytes: Buffer, mime: string, to: string) {
  mkdirSync(dirname(to), { recursive: true });

  if (mime === "image/jpeg") {
    writeFileSync(to, bytes);
    return;
  }

  await sharp(bytes).jpeg({ quality: 90, mozjpeg: true }).toFile(to);
}

function toProduct(draft: Draft, handle: string): RawProduct {
  const p = draft.product;
  const group = GROUP_OF[p.category];
  if (!group) throw new Error(`${draft.id}: unknown category "${p.category}"`);

  const variants: RawVariant[] = [];
  const all: string[] = [];

  for (const variant of p.variants) {
    const colourSlug = slugify(variant.colour);
    const paths = variant.images.map(
      (_, i) =>
        `/images/products/${group}/${p.subCategory}/${handle}/${colourSlug}/${i + 1}.jpeg`,
    );
    all.push(...paths);
    variants.push({
      id: `${handle}--${colourSlug}`,
      colour: variant.colour,
      colourSlug,
      price: p.price,
      images: paths,
      inStock: p.inStock ?? true,
    });
  }

  return {
    id: handle,
    name: p.name,
    shortName: p.shortName,
    category: p.category,
    subCategory: p.subCategory,
    subName: p.subName,
    price: p.price,
    ...(p.mrp ? { mrp: p.mrp } : {}),
    currency: "INR",
    description: p.description,
    features: p.features,
    specifications: p.specifications,
    ...(p.materials?.length ? { materials: p.materials } : {}),
    ...(p.inTheBox?.length ? { inTheBox: p.inTheBox } : {}),
    images: all,
    inStock: p.inStock ?? true,
    variants,
  };
}

async function main() {
  if (!ENDPOINT || !COLLECT_KEY) {
    throw new Error(
      "SUBMIT_ENDPOINT and SUBMIT_COLLECT_KEY must both be set.",
    );
  }

  const drafts = await list();
  if (drafts.length === 0) {
    console.log("Nothing waiting.");
    writeFileSync(RECEIPT, JSON.stringify({ ingested: [] }, null, 2) + "\n");
    return;
  }

  const products = JSON.parse(readFileSync(PRODUCTS, "utf8")) as RawProduct[];
  const taken = new Set(products.map((p) => p.id));
  const ingested: { id: string; name: string; handle: string }[] = [];
  const skipped: string[] = [];

  for (const draft of drafts) {
    const handle = slugify(draft.product.name);
    const group = GROUP_OF[draft.product.category];

    if (!group) {
      skipped.push(
        `${draft.product.name}: unknown category "${draft.product.category}"`,
      );
      continue;
    }

    /*
     * A clash is left alone rather than resolved. Both outcomes of guessing
     * are worse than stopping: a suffixed handle creates a near-duplicate
     * nobody asked for, and overwriting replaces a live product's
     * photographs with a stranger's. The draft stays on the host and the
     * run reports it.
     */
    if (taken.has(handle)) {
      skipped.push(`${draft.product.name}: "${handle}" is already a product`);
      continue;
    }

    const dir = join(IMAGES, group, draft.product.subCategory, handle);
    if (existsSync(dir)) {
      skipped.push(`${draft.product.name}: ${dir} already exists`);
      continue;
    }

    for (const variant of draft.product.variants) {
      const colourSlug = slugify(variant.colour);
      for (const [i, name] of variant.images.entries()) {
        const res = await call("file", { draft: draft.id, name });
        const mime = res.headers.get("content-type") ?? "";
        const bytes = Buffer.from(await res.arrayBuffer());
        await writeImage(bytes, mime, join(dir, colourSlug, `${i + 1}.jpeg`));
      }
    }

    products.push(toProduct(draft, handle));
    taken.add(handle);
    ingested.push({ id: draft.id, name: draft.product.name, handle });
    console.log(`Ingested ${draft.product.name} as ${handle}`);
  }

  if (ingested.length > 0) {
    writeFileSync(PRODUCTS, JSON.stringify(products, null, 2) + "\n", "utf8");

    const lines = [
      "Filed through the form on the site. Nothing here has been read by a person yet.",
      "",
      ...ingested.map((p) => `- **${p.name}** (\`${p.handle}\`)`),
    ];

    if (skipped.length > 0) {
      lines.push(
        "",
        "### Left on the host",
        "",
        "These were not ingested and will be offered again on the next run.",
        "",
        ...skipped.map((s) => `- ${s}`),
      );
    }

    lines.push(
      "",
      "### Before merging",
      "",
      "- Read the description and the feature titles as a customer would",
      "- Check the specifications against the supplier sheet",
      "- Look at every photograph on the product page, not just the first",
      "- Confirm the price and the MRP",
    );

    writeFileSync(PR_BODY, lines.join("\n") + "\n", "utf8");
  }

  writeFileSync(
    RECEIPT,
    JSON.stringify({ ingested, skipped }, null, 2) + "\n",
    "utf8",
  );

  for (const note of skipped) console.warn(`Skipped ${note}`);
  console.log(`${ingested.length} ingested, ${skipped.length} skipped.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
