/**
 * Shared between the build-time image generator and the runtime Next loader,
 * so the two can never disagree about where a derivative lives.
 *
 * ## Why paths are hashed rather than mirrored
 *
 * The source filenames are supplier exports: they contain spaces, mixed case,
 * and in two cases a doubled extension dot. `accessories/Desk-hook/` holds
 * BOTH `1 - Basic..jpeg` and `1 - Basic.jpeg`, and likewise `2 - Plus..jpeg`
 * and `2 - Plus.jpeg`. Any scheme that slugified those names would map two
 * distinct images onto one output file and silently show the wrong product
 * photograph. Hashing the full path sidesteps the whole class of problem and
 * produces URLs that need no percent-encoding.
 *
 * The generator asserts that no two sources share a key, so a collision fails
 * the build rather than corrupting the gallery.
 */

/**
 * Width ladder. Sources top out at 1600px, so nothing above that is useful.
 * Mirrored into `images.deviceSizes` in next.config.ts -- Next asks the loader
 * for these widths, and the generator writes exactly these widths.
 */
export const IMAGE_WIDTHS = [384, 640, 828, 1200, 1600] as const;

export const OPT_DIR = "/images/_opt";

/** Only files under this prefix are routed through the pipeline. */
export const OPT_PREFIX = "/images/";

/**
 * FNV-1a, 32-bit. Chosen because it is four lines, has no dependencies and
 * runs identically in the Node build script and in the browser bundle. This
 * is a filename key, not a security boundary.
 */
export function imageKey(rawPath: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < rawPath.length; i += 1) {
    h ^= rawPath.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Components pass percent-encoded paths, because the origin is case-sensitive
 * Apache and the filenames contain spaces. The generator works from real paths
 * on disk. Decoding here reconciles the two, and is a no-op on a path that was
 * never encoded -- so the loader is correct either way.
 */
export function decodeImagePath(src: string): string {
  return src
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

/** Smallest ladder width that still covers the request. */
export function snapWidth(width: number): number {
  // Written as a loop rather than `find(...) ?? last` because indexing a
  // tuple by a computed position widens to `number | undefined`, while the
  // literal first element does not.
  let chosen: number = IMAGE_WIDTHS[0];
  for (const candidate of IMAGE_WIDTHS) {
    chosen = candidate;
    if (candidate >= width) break;
  }
  return chosen;
}

/** Where the derivative for a given source path and width lives. */
export function optimizedSrc(src: string, width: number): string | null {
  if (!src.startsWith(OPT_PREFIX)) return null;
  if (src.startsWith(`${OPT_DIR}/`)) return null;
  return `${OPT_DIR}/${imageKey(decodeImagePath(src))}-${snapWidth(width)}.webp`;
}
