# HeavenCraft — UX and Product Review

**Site reviewed:** https://theheavencraft.in (live production)
**Scope:** homepage, all three category pages, a sub-category, four product pages, contact, about, shipping and returns policies, the `?cart=on` basket flow through to Shopify checkout, and the 404 page.
**Method:** walked the live site in a browser, then measured it with Playwright at a true phone viewport (Pixel 7, DPR 2.625) and desktop (1440×900), plus throttled 4G runs, byte-level resource accounting, pixel-level contrast sampling over photography, keyboard tab-order tracing, and a read of `src/data/products.json` and the build scripts.
**Constraint honoured:** no application code was changed. This document is the only file added.

Two issues were declared out of scope and are not treated as findings: the fixed 4:5 `object-fit: cover` image crop, and the post-checkout redirect landing on the Shopify domain.

---

## Executive summary — the five things that matter most

**1. For every normal visitor, there is no way to buy anything.** On a default product page the only action is *"Get a price by email"*, which opens a `mailto:` link. *"Add to basket"* appears only with `?cart=on`. I verified this on `/chairs/neuro-mesh-chair/` and `/tables/movix-height-adjustable-table/`. I understand the flag is deliberate — but the machinery behind it is finished and working: the Shopify checkout returns HTTP 200, is branded "Checkout - HeavenCraft", prices in INR, and preselects India with the full state list. A built, tested checkout is earning nothing while the gate is shut. Every other item on this list is worth less than turning this on.

**2. There is no phone number and no WhatsApp anywhere on the site.** The only contact route is `heavencraft09@gmail.com` — a free Gmail address — repeated in the footer, on `/contact/`, and in the policies. For a ₹15,000–₹23,000 furniture purchase in India, from a brand the buyer has not heard of, on a site with no reviews, this is the single largest trust gap. It also blocks LocalBusiness structured data and a Google Business Profile, which is the cheapest local-search traffic available to a Delhi furniture business.

**3. Nobody can tell whether a chair will fit them.** Four of the six chairs have *zero* specifications; the other two have a single row each. No chair on this site states its dimensions, seat-height range, or maximum user weight. The spec table even carries a footnote about dimensions that are not shown. Separately, 23 of 26 products have no "In the box". This is the most common pre-purchase question in ergonomic seating and it is unanswerable here.

**4. The headline text on all three category pages is effectively invisible.** `/chairs/`, `/tables/` and `/accessories/` place the breadcrumb, H1 and description directly over bright product photography with no protection. Measured against the lightest zones of the text area, the `/accessories/` H1 comes out at **1:1** — white text on white. This is the first screen of the site's three main doorways.

**5. A mistyped or stale URL dumps the visitor on GoDaddy's default error page.** The site *has* a well-built branded 404 at `/404.html` that offers the whole catalogue — it is reachable and returns 200. It is simply never served. This matters more than usual here because the previous site used `/product/<id>` URLs, so every stale Google result the redirect map missed lands on a dead end with no navigation back.

---

## What is genuinely good — do not break these

Worth stating plainly, because several of these are better than they need to be and would be easy to lose in a redesign.

- **The image pipeline is a strength, not a liability.** The brief assumed unoptimised static files; that is out of date. Images are built to WebP derivatives (`/images/_opt/*.webp`) with correct `srcset`/`sizes`. I decoded the actual files: `e98c40f2-1200.webp` is genuinely 1086×1448 at 0.11 bytes/pixel; `c871db56-1200.webp` is 1024×1536 at 0.07. They are served with `max-age=31536000` and hit Cloudflare's Delhi edge. This is done well.
  *(I initially recorded a "low resolution images" finding and retracted it — `naturalWidth` on an image with a `w`-descriptor `srcset` is density-corrected, not the file's pixel width. The measurement was wrong, the pipeline is fine.)*
- **Contrast in the CSS-driven parts of the site is excellent.** Across the homepage, the lowest foreground/background pair I could find was 5.27:1. The colour tokens in `globals.css` are disciplined — warm-tinted blacks, a single gold chroma, no drift.
- **Accessibility fundamentals are present and deliberate.** Clean H1→H2→H3 order, a global `:focus-visible` gold outline, a working skip link, `aria-current` on the active nav item, and a real `prefers-reduced-motion` block. Someone thought about this.
- **The policy and About copy is specific and human.** It reads as though a person who knows the business wrote it. It does not read as machine-generated, which is rarer than it should be.
- **Stock messaging is honest.** "Made to order" is stated rather than faked with urgency timers.
- **Fake review data was deliberately withheld.** 17 of 26 products carry seeded ratings in the data, and the code explicitly gates them behind a feature flag and omits `aggregateRating` from the structured data. That is an integrity decision I'd defend, even though it leaves the site with no social proof.
- **The contact form has a real backend.** `/enquiry.php` exists and returns 405 to a GET, with a `mailto:` fallback if it fails. On static hosting with no Node runtime, that is a sensible solution.
- **The checkout itself is reassuring** — branded, INR, India preselected, email captured.

---

## 1. Conversion and commercial

### C-1 — No purchase path for default traffic — **Critical**
A default PDP renders *"Get a price by email"* (a `mailto:`) and no basket control. `src/components/buy-box.tsx` gates "Add to basket" behind `previewEnabled && variantId`.
**Why it matters:** `mailto:` is a poor conversion instrument generally, and on mobile — which is most of this audience — it frequently opens nothing at all, because many Android users have no mail client configured. The likeliest outcome for an interested buyer is a dead tap.
**Fix:** enable commerce. If a staged launch is wanted, enable it on the best-photographed, best-specified category first (tables are in better shape than chairs) rather than site-wide. Until then, replace the `mailto:` with the on-page enquiry form that already exists and works, and add a WhatsApp link.

### C-2 — No phone or WhatsApp — **Critical**
Only a Gmail address, site-wide. `src/lib/site.ts` carries an author comment confirming the street address, pincode and phone are known-outstanding.
**Why it matters:** in Indian furniture retail a phone or WhatsApp number is the default trust signal; a Gmail address reads as a side business. It also blocks LocalBusiness schema and a Google Business Profile listing.
**Fix:** add a WhatsApp click-to-chat link in the header, footer and buy box, plus a phone number. This is the highest-value unblock on the site and is mostly an information problem, not an engineering one.

### C-3 — No social proof anywhere — **High**
No reviews, no ratings, no customer photos, no client list, no "delivered X orders".
**Why it matters:** the site asks for ₹15k–₹23k with nothing but its own word.
**Fix:** collect real reviews post-delivery and turn the existing (already-built) review rendering on with genuine data. In the interim, even non-review proof helps — installation photos, a named B2B client, or years in business as "a unit of Jiwan".

### C-4 — The "why here and not Amazon" case is never made — **High**
Delivery, warranty and returns terms exist on the policies pages but never appear at the point of decision.
**Fix:** put three short reassurance lines directly in the buy box — delivery timeframe to the buyer's region, warranty period, returns window.

---

## 2. Information architecture and navigation

### IA-1 — Identical-looking nav rows lead to different kinds of page — **Medium**
`/accessories/cable-tray/` is a **category** page; `/accessories/cup-holder/` and `/accessories/footrest/` are **product** pages. Sub-categories whose slug matches their single product are marked `collapsed` and skip page generation.
**Why it matters:** the user cannot predict whether a tap leads to a list or a product, and the breadcrumb depth changes underneath them.
**Fix:** the collapsing logic is reasonable; the presentation is not. Mark collapsed entries visually (or route all accessories one level shallower) so the two types are distinguishable.

### IA-2 — Seven "categories" containing exactly one product — **Medium**
Several accessory groups hold a single item, so the visitor pays a navigation step for no choice.
**Fix:** flatten single-product groups into a single `/accessories/` grid.

### IA-3 — "Compare" is not a comparison — **Medium**
The section labelled Compare on PDPs is a related-products rail. Nothing is compared; no attributes are placed side by side.
**Why it matters:** it sets an expectation it does not meet, and a genuine spec comparison is exactly what this catalogue needs (see PDP-1).
**Fix:** either rename it to "Similar products", or make it real — a small table of price, dimensions and adjustment range across 3 chairs would be a genuine differentiator against a marketplace listing.

### IA-4 — Homepage says "Sixteen groups", the site has 15 — **Low**
`src/app/page.tsx` hardcodes the word "Sixteen" in a section lead while the adjacent stat is computed as 15.
**Fix:** derive the word from the same source as the count.

---

## 3. Visual and layout quality

### V-1 — Category hero text sits on bare photography — **Critical**
This is a concrete, locatable bug rather than a matter of taste. `src/app/globals.css` defines `.scrim-bottom` as a **bottom-weighted** gradient — opaque at the bottom, fully transparent at the top. `src/app/[group]/page.tsx` renders the hero image at `-z-10` with that scrim over it, then places breadcrumb → H1 → rule → description at the **top** of a `py-20 lg:py-28` container. The protected band sits under empty space; the text sits on unprotected photo.

Measured contrast, sampling the brightest 12% of each text bounding box as the effective backdrop:

| Page | Element | Mobile | Desktop |
|---|---|---|---|
| `/accessories/` | H1 | **1.00:1** | 1.00:1 |
| `/chairs/` | H1 | 1.12:1 | — |
| `/tables/` | H1 | 1.08:1 | — |
| all three | description | ~1.23:1 | ~1.34:1 |
| all three | breadcrumb | — | ~2.1:1 |

WCAG AA requires 4.5:1 for body text and 3:1 for large text. On the `/accessories/` screenshot the breadcrumb sits over a white monitor and the "A" of "Accessories" over a white book.
**Why it matters:** this is the first screen of the three main entry points into the catalogue, and the brand name and category label are the parts that disappear.
**Fix:** add a `.scrim-hero` (top-weighted, or a full-coverage gradient) in `globals.css` and use it in `[group]/page.tsx`. **Do not change `.scrim-bottom` itself** — the homepage `GroupCard` uses it correctly, because its text is bottom-aligned with `justify-end`.

### V-2 — Photography backdrops fight the palette — **Medium** *(uncertain whether deliberate)*
Several product shots use a tan/orange studio backdrop that clashes with the near-black UI. I cannot tell whether this is a deliberate warm-brand choice or simply what the supplier provided; the rest of the design system is disciplined enough that I suspect the latter.
**Fix:** if it is supplier-supplied, re-shoot or background-replace the hero shot of the top few sellers on a neutral ground.

### V-3 — Six images in a five-column thumbnail grid — **Low**
`product-gallery.tsx` uses `grid-cols-5`; products with six images leave one orphaned on a second row.
**Fix:** `grid-cols-3` on mobile with wrapping, or a scrolling filmstrip.

---

## 4. Product detail pages

### PDP-1 — Chairs have no specifications — **High**
From `src/data/products.json`: four of six chairs have an empty `specifications` array; the remaining two have one row each ("Recline Range" / "Recline positions"). No dimensions, no seat-height range, no maximum user weight, anywhere in the chair catalogue. The rendered table still shows a footnote referring to dimensions.
**Where the data probably is:** the sixth gallery image on the Neuro Mesh Chair is a supplier spec infographic — unreadable at the size it is displayed. The Imperium has a similar "DIMENSIONS" thumbnail. The numbers appear to exist, locked inside images that are neither legible nor machine-readable.
**Why it matters:** "will this fit me / fit under my desk / hold my weight" is the question that decides an ergonomic chair purchase. It is also the question Amazon answers.
**Fix:** transcribe those infographics into `specifications` in `products.json`. This is data entry, not engineering, and it is probably the highest-value hour anyone could spend on this catalogue. Also populate `inTheBox` — 23 of 26 products have none — and remove the dimensions footnote until dimensions exist.

### PDP-2 — Footrest mixes two different products in one spec table — **High**
`/accessories/footrest/` renders ten spec rows spanning two physically different products — "Adjustable Footrest Width…" alongside "Wooden Footrest Width…" — in a single list, with a materials line ("Textured bumps · Massage rollers") that applies only to the adjustable model. The finish picker offers Black / Wooden Teak / Black Marble, so a buyer choosing Wooden Teak reads specifications for a product they are not buying.
*Uncertainty:* commit `f46e234` ("Split merged supplier sheets per finish on Imperium and Footrest") is in the branch I was given, but the live site still shows the merged rows and so does `products.json` at my HEAD — so this may be partially fixed for features/materials but not for `specifications`. Worth confirming against whatever is in flight.

### PDP-3 — Price, title and CTA sit below the fold on mobile — **High**
The gallery occupies effectively the whole first phone screen; the visitor must scroll to find what the product is called and what it costs.
**Fix:** a sticky mobile buy bar (price + primary action) is the standard answer and would serve C-1 at the same time.

### PDP-4 — Gallery has no zoom and no swipe — **Medium**
`product-gallery.tsx` offers thumbnails only — no lightbox, no pinch-zoom, no swipe between images.
**Why it matters:** mesh texture, castor quality and finish are exactly what a furniture buyer wants to inspect closely, and it is the one thing a physical showroom does better.
**Fix:** add a tap-to-zoom lightbox and horizontal swipe.

### PDP-5 — Inconsistent thumbnail labelling — **Low**
The first thumbnail's `aria-label` is the full product alt text while the others are "view 2", "view 3"… Screen-reader users get an inconsistent list.

---

## 5. Cart and checkout

Reviewed through `?cart=on`. The flag persists across navigation, which makes testing easy.

**Working well:** the drawer opens automatically on add, line items and quantities behave, a real Shopify checkout URL is generated on `shop.theheavencraft.in`, and the checkout page is branded, INR-denominated and India-preselected.

### CK-1 — The drawer does not trap focus — **Medium**
`cart-drawer.tsx` sets `role="dialog"` and `aria-modal="true"`, handles Escape, and focuses the panel on open — but keyboard focus escapes to the page behind after six tab stops, and focus is not restored to the trigger on close.
**Fix:** cycle focus within the panel and restore it on close. Also, the full-screen overlay `<button>` duplicates "Close basket" in the tab order and should be `aria-hidden`.

### CK-2 — Quantity steppers are too small to tap — **Medium**
`px-2.5 py-1.5` produces controls well under the 44px minimum, on the screen where a mis-tap costs an order.

### CK-3 — The domain changes at checkout with no warning — **Medium**
The buyer moves from `theheavencraft.in` to `shop.theheavencraft.in`. The subdomain is well chosen and helps, but nothing on the cart panel prepares them.
**Fix:** a short line — "Secure checkout powered by Shopify" — plus payment-method marks before the handoff.

---

## 6. Mobile

### M-1 — No product visible on the first phone screen of the homepage — **High**
The entire first viewport is a text block. A furniture shop's opening screen shows no furniture.
**Fix:** raise the hero image or the first product row above the fold.

### M-2 — Widespread sub-44px tap targets — **Medium**
Between 26 and 43 interactive elements per page fall under 44px at a phone viewport: the header hamburger at 40×40, breadcrumb links ~16px tall, footer links ~15px tall, quantity steppers, and colour swatches at 42px.
**Fix:** raise the header control to 44×44 and add vertical padding to breadcrumb and footer links.

**Good:** no horizontal overflow on any page at any viewport I tested — worth protecting.

---

## 7. Accessibility

Covered above: V-1 (contrast over imagery, **Critical**), CK-1 (focus trap), PDP-5 (labels), M-2 (targets). Two further items:

### A-1 — Homepage hero alt text does not match the photograph — **Medium**
The alt text reads "A white mesh task chair"; the image shows **two dark grey/black** chairs. `HERO_SRC` in `src/app/page.tsx` points at the grey colourway — the alt text appears to have been left behind by a colour change.
**Fix:** correct the alt text, and audit alt text wherever a hero image has been swapped.

### A-2 — Spec infographics carry no text alternative — **Medium**
The supplier spec images (PDP-1) convey information available nowhere else and have no textual equivalent. Transcribing them into `specifications` fixes the accessibility problem and the commercial one together.

---

## 8. Performance

Broadly healthy; the constraint in the brief no longer applies.

Throttled 4G (4 Mbps, 150 ms RTT, 4× CPU):

| Page | Load | FCP | Transferred |
|---|---|---|---|
| Homepage | 3112 ms | 2032 ms | 902 kB |
| Product page | 2449 ms | 1372 ms | — |

Mobile homepage weight is 835 kB, of which 617 kB is imagery; `/accessories/` is 753 kB.

### P-1 — The Open Graph default image is a 679 kB PNG — **Medium**
`/og/default.png` is 679 kB at 1200×630. As WebP or JPEG it would be roughly 60 kB.
**Fix:** re-encode. Pure win, no visible change.

### P-2 — GoDaddy injects a tracking script — **Low**
`tccl.min.js`, ~21 kB, host-injected and of no value to the business. It also prevents the page from ever reaching network idle.
**Fix:** disable it in the cPanel control panel if the plan allows.

*Not asserted:* I could not capture a reliable LCP on the throttled run, so I have FCP and load only. I also observed the font payload varying between 88 kB and 172 kB across page types without determining why — worth a look, but I would not act on my guess.

---

## 9. Content and copy

The baseline here is better than most small-retail sites — the policy and About pages are specific and clearly written by someone who knows the business. The defects are localised:

- **"Sixteen groups" vs 15 categories** on the homepage — **Low** (IA-4).
- **Hero alt text describes the wrong chairs** — **Medium** (A-1).
- **Merged Footrest specifications** — **High** (PDP-2).
- **Meta descriptions truncate mid-word** — **Medium** (see SEO-2).
- **A sub-category description reads "1 cable management trays"** — unsingularised plural, generated in `[group]/[slug]/page.tsx` — **Low**.

---

## 10. SEO and metadata

**Strong foundation:** `robots.txt` and `sitemap.xml` are healthy (46 URLs including policies), canonicals are correct, the homepage carries complete Open Graph and Twitter tags with `og:locale en_IN` and Organization + PostalAddress JSON-LD, and the security headers are in place.

### SEO-1 — The branded 404 page is built but never served — **High**
`/404.html` exists, returns 200, is titled "Page not found | HeavenCraft" and offers the full catalogue. But an unmatched path returns GoDaddy's own 2,066-byte "File not found (404 error)" page.

This is not a missing directive. `scripts/generate-htaccess.ts` line 85 emits `ErrorDocument 404 /404.html`, `verify-export.ts` asserts its presence, and the surrounding comment shows the developer already diagnosed this and tried hoisting the directive above the rewrite blocks. **That attempted fix has not worked in production.** I confirmed the rest of the file *is* live — `/chairs` returns a 301, and the `Header` directives from lines 199–202 are present on live responses. So `.htaccess` is applied and only `ErrorDocument` is being ignored.

Two plausible causes, which I cannot distinguish from outside: either the deployed `.htaccess` predates the hoist (the live build also still shows the merged Footrest specs, so it may well be behind), or GoDaddy overrides `ErrorDocument` at the vhost level.
**Fix:** redeploy and re-test first. If it persists, raise it with GoDaddy as an `AllowOverride FileInfo` question. Either way, add a post-deploy smoke check that requests a random path against production and asserts the body contains "That page has moved" — `verify-export.ts` validates the build artefact, but nothing currently validates what the host actually serves.

### SEO-2 — Product pages share the homepage's social-card treatment — **Medium**
On PDPs, `og:type` is `"website"` rather than `"product"`; `og:image` points at the **raw unoptimised source JPEG** (959×1599, portrait) with no `og:image:width`/`og:image:height`; and the meta description is the product description truncated mid-word at 152 characters.
**Why it matters:** a portrait image with no declared dimensions unfurls badly on WhatsApp — which is how furniture links actually get shared in India — and on Twitter `summary_large_image`.
**Fix:** in `generateMetadata` in `src/app/[group]/[slug]/page.tsx`, set `og:type` to `product`, point `og:image` at a 1200×630 WebP derivative with explicit dimensions, and truncate descriptions on a word boundary.

### SEO-3 — No Product structured data on product pages — **Medium**
Given C-1, `Product` + `Offer` markup with price and availability would make the catalogue eligible for rich results. The decision to omit `aggregateRating` while the ratings are seeded is correct and should stand — but the rest of the Product schema does not depend on it.

---

## If you only do five things

1. **Turn the cart on.** The checkout is built, tested and working; it is producing nothing. Nothing else on this list matters if the site cannot take an order.
2. **Add a phone number and a WhatsApp link** to the header, footer and buy box, and publish the street address. It is the largest trust gap, it costs no engineering, and it unlocks LocalBusiness schema and a Google Business Profile.
3. **Transcribe the chair specifications** out of the supplier infographic images into `products.json` — dimensions, seat height, maximum user weight — and fill in "In the box". An hour of data entry answers the question that decides the sale, and fixes an accessibility gap at the same time.
4. **Add a top-weighted `.scrim-hero`** in `globals.css` and use it in `[group]/page.tsx`. A handful of CSS lines takes the three main category doorways from 1:1 to legible. Leave `.scrim-bottom` alone — the homepage depends on it.
5. **Get the branded 404 actually served**, then add a production smoke check that asserts it. The page is already written and good; it is one deployment or one support ticket away from working, and it is currently catching every stale link from the old `/product/<id>` site with a dead end.
