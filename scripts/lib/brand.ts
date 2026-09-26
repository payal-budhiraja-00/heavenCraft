/**
 * The brand mark, shared by the icon set and the Open Graph cards.
 *
 * Lives here rather than in either generator because both need the same gold
 * monogram keyed out of the same source logo, and a second copy would drift.
 */

import { Buffer } from "node:buffer";
import path from "node:path";
import sharp from "sharp";

export const ROOT = process.cwd();
export const LOGO = path.join(ROOT, "public/images/logo/heavencraft-logo.jpg");

/** The site ground. */
export const BASE = { r: 7, g: 7, b: 6, alpha: 1 };
export const GOLD = "#dea846";
export const GOLD_RGB = { r: 0xde, g: 0xa8, b: 0x46 };

/**
 * The monogram sits inside the ring. This window clears the ring on every side
 * and clears the arced wordmark at the top, leaving the HC and some slack;
 * `trim` then tightens onto the actual gold pixels.
 */
const MONOGRAM_WINDOW = { left: 196, top: 212, width: 452, height: 470 };

/**
 * The HC monogram on transparency, in the exact brand gold.
 *
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
export async function monogram(): Promise<Buffer> {
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
    const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
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
