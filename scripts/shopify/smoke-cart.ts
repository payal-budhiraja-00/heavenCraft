/**
 * End-to-end check: can a browser actually buy one of the new products?
 *
 * Creates a real cart through the same Storefront API the site calls, using a
 * variant ID straight out of the generated map, and reports the checkout URL.
 * Proves the whole chain -- products.json -> Shopify -> variant-ids.generated
 * -> cartLinesAdd -> checkout -- rather than any one link of it.
 */
import { storefront } from "../../src/lib/shopify";
import { GENERATED_VARIANTS } from "../../src/lib/variant-ids.generated";

const MUTATION = `
  mutation Create($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) {
      cart {
        id
        checkoutUrl
        cost { totalAmount { amount currencyCode } }
        lines(first: 10) {
          nodes {
            quantity
            merchandise {
              ... on ProductVariant {
                title
                sku
                product { title handle }
                image { url }
              }
            }
          }
        }
      }
      userErrors { field message }
    }
  }
`;

type Result = {
  cartCreate: {
    cart: {
      id: string;
      checkoutUrl: string;
      cost: { totalAmount: { amount: string; currencyCode: string } };
      lines: {
        nodes: {
          quantity: number;
          merchandise: {
            title: string;
            sku: string;
            product: { title: string; handle: string };
            image: { url: string } | null;
          };
        }[];
      };
    } | null;
    userErrors: { field: string[]; message: string }[];
  };
};

async function main() {
  // One brand-new product and one multi-colour variant: the two cases that
  // did not exist in the old catalogue and so had never been bought.
  const skus = ["peg-board--black", "accessories-footrest-001--wooden-teak"];
  const chosen = skus
    .map((sku) => [sku, GENERATED_VARIANTS[sku]] as const)
    .filter(([, v]) => v !== undefined);

  if (chosen.length === 0) {
    const sample = Object.keys(GENERATED_VARIANTS).slice(0, 8);
    throw new Error(
      `none of ${skus.join(", ")} are in the map. First keys: ${sample.join(", ")}`,
    );
  }

  const lines = chosen.map(([, v]) => ({
    merchandiseId: v!.variantId,
    quantity: 1,
  }));

  const data = await storefront<Result>(MUTATION, { lines });
  const { cart, userErrors } = data.cartCreate;

  if (userErrors.length) {
    for (const e of userErrors) console.error(`  ERROR ${e.message}`);
    process.exit(1);
  }
  if (!cart) throw new Error("no cart returned");

  console.log("cart created\n");
  for (const line of cart.lines.nodes) {
    const m = line.merchandise;
    console.log(`  ${line.quantity} x ${m.product.title} -- ${m.title}`);
    console.log(`      sku   ${m.sku}`);
    console.log(`      image ${m.image ? m.image.url.split("?")[0] : "NONE"}`);
  }
  console.log(
    `\n  total    ${cart.cost.totalAmount.amount} ${cart.cost.totalAmount.currencyCode}`,
  );
  console.log(`  checkout ${cart.checkoutUrl}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
