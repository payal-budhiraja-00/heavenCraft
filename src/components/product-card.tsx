import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/catalog-types";
import { cardImage, encodeImagePath, imageAlt } from "@/lib/images";
import { formatPaise } from "@/lib/money";

/**
 * The product card.
 *
 * The whole card is one link rather than a card containing several links, so
 * the tap target on a phone is the card and there is a single stop in the tab
 * order per product.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const src = cardImage(product);

  return (
    <Link
      href={product.href}
      className="group flex flex-col overflow-hidden rounded-panel border border-edge bg-surface transition-colors duration-300 hover:border-edge-strong"
    >
      <div className="relative aspect-4/5 overflow-hidden bg-raised">
        {src ? (
          <Image
            src={encodeImagePath(src)}
            alt={imageAlt(product)}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 22rem, (min-width: 768px) 33vw, 85vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : null}

        {!product.inStock ? (
          <span className="label absolute left-3 top-3 rounded-plate bg-base/85 px-2.5 py-1.5 text-cream-muted backdrop-blur-sm">
            Made to order
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <span className="label text-cream-faint">{product.subName}</span>

        <h3 className="mt-2 text-base font-semibold leading-snug text-cream transition-colors group-hover:text-gold">
          {product.name}
        </h3>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-cream-muted">
          {product.description}
        </p>

        <div className="mt-5 flex items-end justify-between gap-3 pt-1">
          <span className="tnum text-lg font-bold text-cream">
            {formatPaise(product.pricePaise)}
          </span>
          <span className="label text-gold opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({
  products,
  priorityCount = 0,
}: {
  products: Product[];
  priorityCount?: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, i) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={i < priorityCount}
        />
      ))}
    </div>
  );
}
