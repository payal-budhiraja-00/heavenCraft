import { Container } from "@/components/ui";
import {
  ProductSubmissionForm,
  type CategoryOption,
} from "@/components/product-submission-form";
import { GROUP_OF, groups } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";

const description =
  "Internal form for sending a new product to the HeavenCraft catalogue.";

/*
 * noindex, and deliberately absent from sitemap.ts.
 *
 * Neither is a security control -- the endpoint behind this page is protected
 * by an access code and a rate limit, because a URL that is merely unlisted is
 * a URL that will eventually be found. What they do is keep a staff-only page
 * out of search results, where it would otherwise rank for the shop's own name
 * and send customers to a form asking them for a passphrase.
 */
export const metadata = pageMetadata({
  title: "Submit a product",
  description,
  path: "/submit-product/",
  noindex: true,
});

/*
 * The category list is read from the live catalogue rather than hardcoded, so
 * a range added to products.json shows up here on the next deploy instead of
 * silently going missing from the only form that can file against it.
 *
 * The values are singular -- chair, table, accessories -- because that is what
 * RawProduct.category expects and what the PHP validator checks against. The
 * group slugs are plural, so GROUP_OF is inverted here rather than restated:
 * one more copy of that mapping is one more place for it to drift.
 */
const SINGULAR = Object.fromEntries(
  Object.entries(GROUP_OF).map(([singular, plural]) => [plural, singular]),
);

function categories(): CategoryOption[] {
  return groups.map((group) => ({
    value: SINGULAR[group.slug] ?? group.slug,
    label: group.name,
    ranges: group.subCategories.map((sub) => ({
      slug: sub.slug,
      name: sub.name,
    })),
  }));
}

export default function SubmitProductPage() {
  return (
    <Container className="py-14 lg:py-20">
      <ProductSubmissionForm categories={categories()} />
    </Container>
  );
}
