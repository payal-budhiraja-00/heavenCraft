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
import { BASE, GOLD, monogram, ROOT } from "./lib/brand";

/*
 * The homepage hero. Pointed at "4 - Neuro.jpeg" until the September 2026
 * catalogue replaced it, which left this script unable to run at all -- the
 * committed card outlived its own source. Using the same frame the hero uses
 * keeps the two in step.
 */
const HERO = path.join(
  ROOT,
  "public/images/products/chairs/mesh-chair/neuro-mesh-chair/grey/3.jpeg",
);
const ICON_DIR = path.join(ROOT, "public/icons");
const OG_DIR = path.join(ROOT, "public/og");

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
 * The header mark: the monogram inside a ring, on transparency.
 *
 * The ring is redrawn rather than cropped out of the source. The original is a
 * JPEG, so its ring carries compression artefacts and a colour gradient that
 * both show badly at 32px, and the arced "HeavenCraft" set inside the top of
 * it is an illegible smudge at that size -- as well as being redundant next to
 * the typed wordmark it sits beside. A clean circle keeps the badge identity
 * and drops the part that does not survive the size.
 */
async function badge(size = 256): Promise<Buffer> {
  const glyph = await monogram();

  const stroke = Math.round(size * 0.031); // matches the source ring's weight
  const radius = size / 2 - stroke / 2 - 1;

  const ring = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
              fill="none" stroke="${GOLD}" stroke-width="${stroke}"/>
    </svg>`,
  );

  // In the source the monogram fills most of the ring. Kept generous, because
  // at 32px the ring is barely a pixel and the glyph is what has to read.
  const inner = Math.round(size * 0.62);
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
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: ring },
      { input: scaled, gravity: "centre" },
    ])
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
 *
 * Encoded as JPEG. It was a PNG at 695 kB, which is above WhatsApp's ~600 kB
 * ceiling for fetching a preview image -- so the card most likely to be shared
 * in this market was the one most likely not to render. It is a photograph
 * with a gradient behind type; PNG was the wrong container for it.
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
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
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
  await writeFile(path.join(OG_DIR, "default.jpg"), og);
  console.log(`  public/og/default.jpg (${og.length} bytes)`);

  // Rendered at 256 and displayed around 32, so it stays sharp on 3x screens.
  const mark = await badge(256);
  await writeFile(path.join(ICON_DIR, "monogram.png"), mark);
  console.log(`  public/icons/monogram.png (${mark.length} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
