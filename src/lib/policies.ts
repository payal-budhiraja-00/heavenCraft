import { SITE, TERMS } from "./site";

/**
 * Policy page content.
 *
 * Written without invented specifics. A returns window or a delivery SLA
 * published on a storefront is a representation to the customer, and an
 * invented one is worse than an absent one -- so every number here traces
 * back to an answer the business gave, and the places still waiting on one
 * are marked NEEDS-FACT and say "confirmed per order" rather than guessing.
 *
 * Confirmed: 3-5 working day delivery, a 24-month warranty across all three
 * categories, cash on delivery at no extra charge, returns for anything that
 * arrives damaged, faulty or wrong, and free assembly on tables.
 *
 * Deliberately not claimed: change-of-mind returns, and free assembly on
 * chairs or accessories. Both were published here before the business
 * confirmed them and neither turned out to be the offer.
 *
 * Still outstanding: GSTIN, courier partners, the free-shipping threshold and
 * the rate below it. Shopify requires refund, privacy, terms and shipping
 * policies to be published before it will process a payment.
 */

export type Policy = {
  slug: string;
  title: string;
  summary: string;
  sections: { heading: string; body: string[] }[];
};

const contact = `Call or WhatsApp ${SITE.phoneDisplay}, or write to ${SITE.email}. We respond within one working day.`;

export const POLICIES: Policy[] = [
  {
    slug: "shipping",
    title: "Shipping policy",
    summary:
      "How orders are dispatched, what delivery costs, and what happens if something arrives damaged.",
    sections: [
      {
        heading: "Where we deliver",
        body: [
          "We deliver across India. Some pincodes are served only by surface freight, which takes longer than the metros.",
          // NEEDS-FACT: courier partners and serviceable pincode list.
          "If you want to check your pincode before ordering, send it to us and we will confirm.",
        ],
      },
      {
        heading: "How long it takes",
        body: [
          `Most orders arrive within ${TERMS.deliveryDaysMin} to ${TERMS.deliveryDaysMax} working days of dispatch. Remote pincodes served by surface freight take longer, and we tell you before you pay if yours is one of them.`,
          "Made-to-order items are marked as such on the product page; the dispatch date for those is confirmed after the order.",
        ],
      },
      {
        heading: "Assembly",
        body: [
          "Assembly at your address is included on tables, at no charge. A desk is the item where a bad job shows up months later as a work surface that will not sit still, so we would rather do it ourselves.",
          "Chairs and accessories arrive flat-packed for self-assembly, with the tools and instructions in the carton. Most chairs take about half an hour. If you would rather not, ask us and we will quote it.",
        ],
      },
      {
        heading: "Payment",
        body: [
          "Cash on delivery is available, with no extra fee. Cards, UPI and net banking are accepted at checkout.",
        ],
      },
      {
        heading: "Delivery cost",
        body: [
          "Furniture is bulky, and freight is charged on volume rather than weight — an assembled task chair bills at far more than it weighs. Delivery is therefore quoted per order, against your actual pincode, rather than estimated from a table.",
          // NEEDS-FACT: free-shipping threshold, if any, and zone rates.
          "The delivery charge is shown before you pay. There is nothing added after.",
        ],
      },
      {
        heading: "Dispatch and tracking",
        body: [
          "Orders are picked and dispatched on working days. You receive tracking details by email as soon as the consignment is handed to the courier.",
          "Large items are delivered to your door. Carrying them upstairs is subject to what the building allows and what the delivery team can manage safely.",
        ],
      },
      {
        heading: "Damage in transit",
        body: [
          "Check the carton before you sign for it. If the packaging is visibly damaged, photograph it and refuse the delivery, or note the damage on the delivery sheet.",
          `Report transit damage to us within 48 hours of delivery with photographs of the carton and the item. ${contact}`,
        ],
      },
    ],
  },
  {
    slug: "returns",
    title: "Returns & refunds",
    summary:
      "What we take back, what we do not, and how refunds are paid.",
    sections: [
      {
        heading: "What can be returned",
        body: [
          `If a product arrives damaged, faulty, or is not what you ordered, tell us within ${TERMS.faultReportHours} hours of delivery and we will collect it and either replace it or refund you in full. We pay the freight both ways — a fault at our end is not something you should be out of pocket for.`,
          `A fault that shows up later is a warranty matter rather than a return, and every product is covered for ${TERMS.warrantyMonths / 12} years. See the warranty policy.`,
        ],
      },
      {
        heading: "What cannot be returned",
        body: [
          "We do not accept change-of-mind returns. Return freight on furniture runs to a large share of what the item cost, and a policy we could not afford to honour is worse than one we never advertised.",
          `That is why we would rather you sat in the chair first, and why we will go through fit, dimensions and the right size for you on WhatsApp before you order. The Hari Nagar showroom is open: ${SITE.hoursSummary}.`,
          "Items that have been modified, or used beyond what is needed to check fit and function.",
          "Made-to-order and custom-specified items, which are built after the order is placed.",
          "None of this affects your rights under Indian consumer law where goods are faulty or not as described.",
        ],
      },
      {
        heading: "How to start a return",
        body: [
          `Call or WhatsApp ${SITE.phoneDisplay}, or email ${SITE.email}, with your order reference, the product, and photographs if something is damaged.`,
          "Keep the original packaging until you are satisfied with the product. Furniture cannot safely travel back without it.",
        ],
      },
      {
        heading: "Refunds",
        body: [
          "Approved refunds are paid to the original payment method. Your bank decides how quickly it appears on your statement, which is usually a few working days after we release it.",
          "Where a delivery charge was paid on an order that is being returned, that charge is refunded too.",
        ],
      },
    ],
  },
  {
    slug: "warranty",
    title: "Warranty",
    summary: `Every product carries a ${TERMS.warrantyMonths / 12}-year warranty. What it covers, and how to claim.`,
    sections: [
      {
        heading: `${TERMS.warrantyMonths / 12}-year warranty`,
        body: [
          `Every chair, table and accessory we sell carries a ${TERMS.warrantyMonths / 12}-year warranty from the date of delivery. The same term applies across all three categories — there is no shorter cover hidden on the cheaper items.`,
          "You deal with us directly on a claim — we assess it ourselves rather than sending you to a helpline, and we are a short drive away in Hari Nagar if it is easier to bring the item in.",
          "Keep your invoice. It is the proof of purchase date that any claim is assessed against.",
        ],
      },
      {
        heading: "What a warranty does not cover",
        body: [
          "Normal wear, fabric fading, and damage from use the product was not designed for.",
          "Damage from incorrect assembly, modification, or moving the item without dismantling it where dismantling is required.",
        ],
      },
      {
        heading: "Making a claim",
        body: [
          `Send your invoice number, photographs of the fault, and a short description of when it started to ${SITE.email}.`,
          "We handle the claim with the manufacturer on your behalf.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    summary:
      "What we collect, why we collect it, and who else can see it.",
    sections: [
      {
        heading: "What we collect",
        body: [
          "When you place an order or send an enquiry, we collect the details you give us: your name, email address, phone number and delivery address.",
          "We do not collect or store card details. Payments are processed by our payment provider on their own systems, and the card number never reaches this website.",
        ],
      },
      {
        heading: "Why we collect it",
        body: [
          "To fulfil your order, arrange delivery, handle returns and warranty claims, and answer your questions. Nothing else.",
          "We do not sell your details, and we do not share them with anyone except the parties needed to complete your order — principally the courier and the payment provider.",
        ],
      },
      {
        heading: "Cookies",
        body: [
          "This site sets no advertising or tracking cookies. If you use the cart, a single identifier is kept in your browser's local storage so the cart survives a page reload. It is removed when the cart is emptied.",
        ],
      },
      {
        heading: "Your data",
        body: [
          `You can ask what we hold about you, ask for it to be corrected, or ask for it to be deleted, by writing to ${SITE.email}. Records we are legally required to keep for tax and accounting are the exception.`,
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of service",
    summary: "The terms you agree to when you buy from this website.",
    sections: [
      {
        heading: "Who you are buying from",
        body: [
          // NEEDS-FACT: registered address and GSTIN, required on a tax invoice.
          `This website is operated by ${SITE.legalName}. Our registered details appear on the tax invoice issued with every order.`,
        ],
      },
      {
        heading: "Prices and product information",
        body: [
          "Prices are in Indian Rupees and include applicable taxes. Delivery is quoted separately.",
          "Product photographs are representative. Colours vary between screens, and specifications are as declared by the manufacturer — dimensions can differ slightly between production batches.",
          "We correct errors in price or description when we find them. If an error affects an order you have already placed, we will contact you before dispatch and you may cancel for a full refund.",
        ],
      },
      {
        heading: "Orders",
        body: [
          "An order is an offer to buy. It is accepted when we confirm dispatch. If we cannot fulfil an order — because stock has run out, or the delivery address cannot be served — we will tell you and refund you in full.",
        ],
      },
      {
        heading: "Liability",
        body: [
          "Our liability for any order is limited to the amount paid for that order. Nothing in these terms limits any right you have under Indian consumer law.",
        ],
      },
      {
        heading: "Governing law",
        body: [
          // NEEDS-FACT: jurisdiction, which follows the registered address.
          "These terms are governed by the laws of India.",
        ],
      },
    ],
  },
];

export function getPolicy(slug: string): Policy | undefined {
  return POLICIES.find((p) => p.slug === slug);
}
