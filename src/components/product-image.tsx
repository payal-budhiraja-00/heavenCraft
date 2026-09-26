import Image from "next/image";
import { encodeImagePath, imageFocus } from "@/lib/images";

/**
 * A product photograph in a fixed box.
 *
 * ## Why this is not just an `<Image>`
 *
 * Two things have to be decided per placement, and getting either wrong is
 * visible from across the room.
 *
 * **Where to crop.** A card fills its box, so something is thrown away. The
 * default is to keep the middle, but the supplier's studio frames leave a
 * stretch of empty backdrop above each chair, so keeping the middle drifted
 * down and cut the headrest off. `imageFocus` supplies a measured point for
 * the frames that need one -- see `scripts/generate-focus.ts`.
 *
 * **Whether to crop at all.** Most placements should crop: a tile with bars
 * down the side reads as a loading failure. But the galleries carry the
 * supplier's dimension and feature drawings alongside the photographs, and
 * those are text. Cropping a drawing deletes the measurements, so a gallery
 * asks for `contain` and accepts the bars.
 *
 * An earlier version filled the bars with a blurred, scaled-up copy of the
 * photograph. It kept every pixel and it was rejected on sight -- it made
 * every product look like it was floating on a smear. Bars are better than
 * that, and cropping to a ratio that suits the photograph is better than
 * both, which is what `gridAspect` is for.
 *
 * The caller owns the box: this fills whatever `relative` element it is put
 * in, and that element should clip.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  priority = false,
  className = "",
  /**
   * `contain` for anything that might be a drawing rather than a photograph,
   * because cropping one destroys the information it exists to carry.
   */
  fit = "cover",
  /** Only meaningful with `contain`: keeps the subject off the border. */
  inset = "",
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  fit?: "cover" | "contain";
  inset?: string;
}) {
  const href = encodeImagePath(src);

  if (fit === "contain") {
    return (
      <Image
        src={href}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={`object-contain ${inset} ${className}`}
      />
    );
  }

  return (
    <Image
      src={href}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      style={{ objectPosition: imageFocus(src) }}
      className={`object-cover ${className}`}
    />
  );
}
