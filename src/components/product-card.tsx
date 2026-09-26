import Link from "next/link";
import type { Product } from "@/lib/catalog-types";
import { cardImage, gridAspect, imageAlt } from "@/lib/images";
import { formatPaise } from "@/lib/money";
import { ProductImage } from "./product-image";

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
  /**
   * Set by the grid so every card in one row is the same shape. Left to the
   * product's own category when a card is placed on its own.
   */
  aspect,
}: {
  product: Product;
  priority?: boolean;
  aspect?: string;
}) {
  const src = cardImage(product);
  const box = aspect ?? gridAspect([product]);

  return (
    <Link
      href={product.href}
      className="group flex flex-col overflow-hidden rounded-panel border border-edge bg-surface transition-colors duration-300 hover:border-edge-strong"
    >
      <div className={`relative ${box} overflow-hidden bg-raised`}>
        {src ? (
          <ProductImage
            src={src}
            alt={imageAlt(product)}
            priority={priority}
            sizes="(min-width: 1280px) 22rem, (min-width: 768px) 33vw, 85vw"
            className="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
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
          {/*
            There is no hover on a touch screen, so this would never appear on
            the devices most of these visitors use. Show it outright there.
          */}
          <span className="label text-gold opacity-0 transition-opacity duration-200 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
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
  // Decided once for the whole grid rather than per card: a row of cards whose
  // photographs are different heights looks broken even when each individual
  // crop is the better one.
  const aspect = gridAspect(products);

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, i) => (
        <ProductCard
          key={product.id}
          product={product}
          aspect={aspect}
          priority={i < priorityCount}
        />
      ))}
    </div>
  );
}
