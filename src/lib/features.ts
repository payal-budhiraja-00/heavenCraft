/**
 * Feature flags.
 *
 * This is a static export, so every flag is resolved at build time and baked
 * into the HTML. There is no runtime to change one -- flipping a flag means a
 * rebuild, which is the same cost as any other content change here.
 *
 * The site launches as a catalog with enquiries. Cart and checkout are built
 * behind `commerce` so the Shopify integration can be finished and switched on
 * without unpicking the pages around it.
 */

function flag(value: string | undefined): boolean {
  return value === "true";
}

export const features = {
  /**
   * Cart, checkout and online payment through Shopify. While false the product
   * page asks for an enquiry instead and no cart UI is linked from anywhere.
   *
   * Turning this on requires a Shopify store with every product present as a
   * Product + ProductVariant, because the Cart API is variant-bound. Until
   * those variant IDs exist there is nothing for an add-to-cart button to add.
   *
   * On in CI and in the deploy workflow, so this is the whole gate: there is
   * no longer a second client-side switch deciding who may see the cart.
   */
  commerce: flag(process.env.NEXT_PUBLIC_COMMERCE_ENABLED),

  /**
   * Customer reviews, and the aggregateRating they would feed into structured
   * data.
   *
   * Every one of the 34 products carries reviews in products.json and not one
   * sits below four stars, which is what seeded demo content looks like rather
   * than what a real review distribution looks like.
   *
   * `reviews` decides whether the section renders at all. `reviewsAreReal`
   * decides how much it may claim, and the two are separate on purpose:
   * showing placeholder copy while a design is being reviewed is ordinary, but
   * attaching "Verified" to an invented person, or emitting a fabricated star
   * rating into Google's index, are not the same act. The first is a fake
   * testimonial; the second is a search-policy breach that gets a storefront
   * penalised long before anyone notices.
   */
  reviews: flag(process.env.NEXT_PUBLIC_REVIEWS_ENABLED),
  reviewsAreReal: flag(process.env.NEXT_PUBLIC_REVIEWS_ARE_REAL),
} as const;

export type Features = typeof features;
