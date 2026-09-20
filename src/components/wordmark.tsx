import Image from "next/image";

/**
 * The name is typographic, the mark is an image.
 *
 * The supplied logo sets "HeavenCraft" on an arc inside a gold ring around an
 * HC monogram. That arc is unreadable below about 64px, which is most of the
 * places a header logo appears, and it would repeat the name it sits beside.
 * So the mark keeps the ring and the monogram, and the name is set in type --
 * Archivo at its wide width, the same face the headings use.
 */

const sizes = {
  sm: { text: "text-sm", mark: 24, tagline: "text-[0.5625rem]" },
  md: { text: "text-base", mark: 30, tagline: "text-[0.625rem]" },
  lg: { text: "text-xl", mark: 34, tagline: "text-[0.6875rem]" },
} as const;

export function Wordmark({
  size = "md",
  withTagline = false,
  withMark = true,
  priority = false,
}: {
  size?: keyof typeof sizes;
  withTagline?: boolean;
  withMark?: boolean;
  priority?: boolean;
}) {
  const s = sizes[size];

  return (
    <span className="inline-flex items-center gap-2.5">
      {withMark ? (
        <Image
          src="/icons/monogram.png"
          alt=""
          width={s.mark}
          height={s.mark}
          priority={priority}
          /*
           * Decorative: the brand name is already spelled out beside it, so
           * announcing the mark as well would read the name twice.
           */
          aria-hidden="true"
          className="shrink-0"
          style={{ width: s.mark, height: s.mark }}
        />
      ) : null}

      <span className="inline-flex flex-col leading-none">
        <span
          className={`type-wide font-bold tracking-[-0.02em] text-cream ${s.text}`}
        >
          HEAVEN<span className="text-gold">CRAFT</span>
        </span>
        {withTagline ? (
          <span
            className={`mt-1 uppercase tracking-[0.18em] text-cream-faint ${s.tagline}`}
          >
            A unit of Jiwan
          </span>
        ) : null}
      </span>
    </span>
  );
}
