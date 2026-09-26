import Image from "next/image";
import { encodeImagePath } from "@/lib/images";

/**
 * A product photograph fitted into a fixed box without cutting the product up.
 *
 * ## Why this exists
 *
 * The catalogue mixes two kinds of supplier photography: tall studio shots on
 * a seamless paper backdrop (the chairs, around 0.53:1) and wide lifestyle
 * room shots (the tables, around 1.60:1). That is a threefold spread of aspect
 * ratio being poured into one fixed box.
 *
 * With `object-fit: cover` the box is filled by throwing away whatever does
 * not fit, so the executive table lost both its legs and the mesh chair lost
 * its headrest and its castors -- the category tile showed a band of upholstery
 * that could have been almost any piece of furniture.
 *
 * `contain` fixes that, but it leaves bars, and no single bar colour can sit
 * behind both a tan seamless backdrop and a grey office floor without one of
 * them looking like a mistake. So the photograph is drawn twice: once scaled
 * up, blurred and cropped to fill the box, and once contained on top of it.
 * The bars are then always drawn from that photograph's own colours.
 *
 * ## Cost
 *
 * The backdrop asks for the smallest rung of the width ladder (384px). It is
 * blurred past all recognition, so resolution is irrelevant, and on a product
 * card that rung is usually the one already being fetched for the foreground.
 *
 * The caller owns the box: this fills whatever `relative` element it is put
 * in, which must clip (`overflow-hidden`) because the backdrop is scaled past
 * the edges to keep the blur from feathering into the border.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  priority = false,
  /** Applied to the foreground only, so hover transforms leave the backdrop still. */
  className = "",
  /** Keeps the product clear of the card edge. Not applied to the backdrop. */
  inset = "",
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  inset?: string;
}) {
  const href = encodeImagePath(src);

  return (
    <>
      <Image
        src={href}
        alt=""
        aria-hidden="true"
        fill
        sizes="384px"
        className="scale-125 object-cover blur-2xl"
      />

      <Image
        src={href}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={`object-contain ${inset} ${className}`}
      />
    </>
  );
}
