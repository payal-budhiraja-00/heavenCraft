# Filling in `owner-input.csv`

34 rows, one per product. Regenerate it any time with `npm run shopify:csv` —
but copy your filled-in version somewhere first, because regenerating writes a
blank sheet.

Rows are sorted by **Category**. HSN, GST rate, country of origin, warranty and
assembly are in practice the same for every product in a category, so fill the
first row of a group and drag down. That turns roughly 370 cells into about 60
real decisions.

## Don't edit these

`Handle`, `Category`, `Title`, `Variant SKU`, `Price (INR)` come from the site
catalog and are there so you can identify the row. `Handle` is what matches the
row back to Shopify, so if it changes the row stops matching anything.

## Needed before weight-based shipping or GST invoices

| Column | Where it comes from | What happens if blank |
| --- | --- | --- |
| **HSN code** | Supplier invoice, or your CA. Seats are usually `9401`, other furniture `9403`. | Tax invoices are not GST-compliant. |
| **GST rate %** | Follows the HSN code. Confirm with your CA — furniture rates were restructured recently and I'd rather you check than take my word. | Same as above. |
| **Country of origin** | Supplier invoice or import documents. | Only matters for customs on exports. Safe to leave blank while you ship domestically. Don't guess: a wrong declaration is your legal exposure, which is why I left it empty rather than pre-filling "India". |
| **Boxed weight (kg)** | Weigh one packed carton, or read the supplier spec sheet. | **The dangerous one.** Shopify reads a missing weight as **0 kg**, silently. Any weight-based shipping rate then puts a 20 kg desk in the lightest bracket and you absorb the freight on every order — with no error shown. Harmless only while you're on flat-rate shipping. |
| **Box length / width / height (cm)** | Measure the carton. | Couriers price on volumetric weight for bulky-but-light items, so without these you can't compare quotes or auto-book pickups. |

## Improves the listing, whenever you get to it

| Column | Why it's worth having |
| --- | --- |
| **Net weight (kg)** | The product's own weight, without packaging. Buyers comparing chairs use it as a proxy for build quality. |
| **Warranty (months)** | Consistently one of the first questions asked about furniture at this price. Having it on the page removes a reason to leave and ask. |
| **Max user weight (kg)** | Matters most for chairs. Its absence is conspicuous to anyone who needs it, and its presence is reassuring to everyone else. |
| **Assembly required (Yes/No)** | Sets expectations before delivery rather than after, which is where the complaint would otherwise come from. |

## When it's filled

Send it back and I'll push the values into Shopify — they map onto real Shopify
fields (weight and HS code on the variant, the rest as product metafields shown
on the page), so nothing here is busywork for its own sake.

Partial is fine. Weights alone unblock real shipping rates.
