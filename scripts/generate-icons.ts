/**
 * Generates the favicon, PWA icon and Open Graph image set.
 *
 * Run with `npm run icons`. The output is committed to `public/` rather than
 * generated during deploy, for two reasons: Google requires the favicon URL to
 * stay stable between crawls, and the Open Graph card is rendered with system
 * fonts, which differ between this machine and a CI runner.
 *
 * The source logo is a gold ring with the brand name set on an arc and an HC
 * monogram in the middle. The arc is unreadable below about 64px -- which is
 * every size a favicon is ever seen at -- so only the monogram is used. The
 * ring goes too: at 32px a 3px-wide ring is one grey pixel of anti-aliasing.
 */

import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const LOGO = path.join(ROOT, "public/images/logo/heavencraft-logo.jpg");
const HERO = path.join(
  ROOT,
  "public/images/products/chairs/mesh-chair/4 - Neuro.jpeg",
);
const ICON_DIR = path.join(ROOT, "public/icons");
const OG_DIR = path.join(ROOT, "public/og");

const BASE = { r: 7, g: 7, b: 6, alpha: 1 };
const GOLD = "#dea846";
const GOLD_RGB = { r: 0xde, g: 0xa8, b: 0x46 };

/**
 * The monogram sits inside the ring. This window clears the ring on every side
 * and clears the arced wordmark at the top, leaving the HC and some slack;
 * `trim` then tightens onto the actual gold pixels.
 */
const MONOGRAM_WINDOW = { left: 196, top: 212, width: 452, height: 470 };

/**
 * The logo is a JPEG, so the monogram arrives on a black rectangle rather than
 * on transparency -- and that black is not the same black as the site ground,
 * which leaves a visible square seam around the glyph at every size.
 *
 * Rather than trying to match the two blacks, the glyph is keyed out: the
 * source luminance becomes the alpha channel and the colour is replaced with
 * the exact brand gold. That kills the seam, repairs the JPEG's colour drift,
 * and keeps the original anti-aliasing as partial alpha instead of as a halo
 * of dark pixels.
 */
async function monogram(): Promise<Buffer> {
  const { data, info } = await sharp(LOGO)
    .extract(MONOGRAM_WINDOW)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Luminance of the brand gold. Anything at or above it is fully opaque.
  const GOLD_LUM =
    0.299 * GOLD_RGB.r + 0.587 * GOLD_RGB.g + 0.114 * GOLD_RGB.b;
  const FLOOR = 14; // JPEG noise in the black ground
  const span = GOLD_LUM - FLOOR;

  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const lum =
      0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    const alpha = Math.round(
      Math.min(255, Math.max(0, ((lum - FLOOR) / span) * 255)),
    );
    rgba[j] = GOLD_RGB.r;
    rgba[j + 1] = GOLD_RGB.g;
    rgba[j + 2] = GOLD_RGB.b;
    rgba[j + 3] = alpha;
  }

  return sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
}

/** The monogram centred on the brand ground, with optical margin. */
async function icon(size: number, glyph: Buffer, inset = 0.74): Promise<Buffer> {
  const inner = Math.round(size * inset);

  const scaled = await sharp(glyph)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BASE,
    },
  })
    .composite([{ input: scaled, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * ICO container holding PNG payloads.
 *
 * Every browser that matters has read PNG-in-ICO since Vista, and it keeps the
 * file a fraction of the size of the equivalent BMP encoding. Written by hand
 * because sharp has no ICO encoder and this is 30 lines of header.
 */
function buildIco(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  const ENTRY = 16;
  let offset = header.length + images.length * ENTRY;

  const entries: Buffer[] = [];
  for (const { size, data } of images) {
    const entry = Buffer.alloc(ENTRY);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette size
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([
    header,
    ...entries,
    ...images.map((i) => i.data),
  ]);
}

/**
 * The Open Graph card. Photograph on the right, type on the left, same split
 * as the hero, so a link preview looks like the page it opens.
 */
async function openGraph(glyph: Buffer): Promise<Buffer> {
  const W = 1200;
  const H = 630;

  const photo = await sharp(HERO)
    .resize(560, H, { fit: "cover", position: "centre" })
    .toBuffer();

  const scrim = Buffer.from(
    `<svg width="560" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="s" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#070706" stop-opacity="0.95"/>
          <stop offset="45%" stop-color="#070706" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#070706" stop-opacity="0.1"/>
        </linearGradient>
      </defs>
      <rect width="560" height="${H}" fill="url(#s)"/>
    </svg>`,
  );

  const type = Buffer.from(
    `<svg width="640" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .eyebrow { font: 600 20px 'Segoe UI', Arial, sans-serif; letter-spacing: 3px; fill: ${GOLD}; }
        .h1 { font: 700 76px 'Segoe UI', Arial, sans-serif; letter-spacing: -2px; fill: #f4ede0; }
        .lead { font: 400 24px 'Segoe UI', Arial, sans-serif; fill: #a8a093; }
        .brand { font: 700 24px 'Segoe UI', Arial, sans-serif; letter-spacing: 1px; fill: #f4ede0; }
        .gold { fill: ${GOLD}; }
      </style>
      <text x="72" y="150" class="eyebrow">ERGONOMIC WORKSPACE FURNITURE</text>
      <rect x="72" y="176" width="72" height="2" fill="${GOLD}"/>
      <text x="72" y="286" class="h1">Built for the</text>
      <text x="72" y="368" class="h1 gold">eight-hour day.</text>
      <text x="72" y="432" class="lead">Chairs, height-adjustable desks and</text>
      <text x="72" y="466" class="lead">workspace accessories.</text>
      <text x="152" y="556" class="brand">HEAVEN<tspan class="gold">CRAFT</tspan></text>
    </svg>`,
  );

  const badge = await sharp(glyph)
    .resize(56, 56, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  return sharp({
    create: { width: W, height: H, channels: 4, background: BASE },
  })
    .composite([
      { input: photo, left: W - 560, top: 0 },
      { input: scrim, left: W - 560, top: 0 },
      { input: type, left: 0, top: 0 },
      { input: badge, left: 72, top: 496 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  await mkdir(ICON_DIR, { recursive: true });
  await mkdir(OG_DIR, { recursive: true });

  const glyph = await monogram();
  const meta = await sharp(glyph).metadata();
  console.log(`monogram trimmed to ${meta.width}x${meta.height}`);

  // Small sizes get less margin, because at 16px a generous inset leaves the
  // glyph too small to read.
  const plan: { name: string; size: number; inset: number }[] = [
    { name: "icon-16.png", size: 16, inset: 0.88 },
    { name: "icon-32.png", size: 32, inset: 0.84 },
    { name: "icon-48.png", size: 48, inset: 0.8 },
    { name: "icon-192.png", size: 192, inset: 0.74 },
    { name: "icon-512.png", size: 512, inset: 0.74 },
    // Apple crops to a rounded rect and does not honour transparency, so this
    // one keeps its opaque ground and a wider margin.
    { name: "apple-touch-icon.png", size: 180, inset: 0.66 },
  ];

  for (const { name, size, inset } of plan) {
    const data = await icon(size, glyph, inset);
    await writeFile(path.join(ICON_DIR, name), data);
    console.log(`  public/icons/${name}`);
  }

  const ico = buildIco([
    { size: 16, data: await icon(16, glyph, 0.88) },
    { size: 32, data: await icon(32, glyph, 0.84) },
    { size: 48, data: await icon(48, glyph, 0.8) },
  ]);
  await writeFile(path.join(ROOT, "public/favicon.ico"), ico);
  console.log(`  public/favicon.ico (${ico.length} bytes, 16/32/48)`);

  const og = await openGraph(glyph);
  await writeFile(path.join(OG_DIR, "default.png"), og);
  console.log(`  public/og/default.png (${og.length} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
