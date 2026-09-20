/**
 * The wordmark is typographic, not an image file.
 *
 * The supplied logo is a gold monogram inside a ring with the brand name set
 * on an arc around it. That arc is unreadable below about 64px, which is most
 * of the places a header logo actually appears, so the name is set in type --
 * Archivo at its wide width, which is the same face the headings use -- and
 * the ring is kept for the favicon and the footer where it has room to work.
 */

const sizes = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
} as const;

export function Wordmark({
  size = "md",
  withTagline = false,
}: {
  size?: keyof typeof sizes;
  withTagline?: boolean;
}) {
  return (
    <span className="inline-flex flex-col leading-none">
      <span
        className={`type-wide font-bold tracking-[-0.02em] text-cream ${sizes[size]}`}
      >
        HEAVEN<span className="text-gold">CRAFT</span>
      </span>
      {withTagline ? (
        <span className="mt-1 text-[0.625rem] uppercase tracking-[0.18em] text-cream-faint">
          A unit of Jiwan
        </span>
      ) : null}
    </span>
  );
}
