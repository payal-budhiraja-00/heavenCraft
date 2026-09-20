"use client";

import { useState } from "react";
import { Button } from "./ui";
import { SITE } from "@/lib/site";

/**
 * The enquiry form.
 *
 * There is no server here -- this is a static export on Apache -- so the form
 * composes a mailto: rather than posting anywhere. That is a deliberate
 * trade: it keeps the enquiry working with no third-party form service, no
 * account, and no customer data passing through anyone else's system. The
 * direct address is shown next to it for anyone whose device handles mailto
 * badly.
 */
export function ContactForm() {
  const [sent, setSent] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const subject = String(data.get("subject") || "Website enquiry");
    const body = [
      `Name: ${data.get("name") || ""}`,
      `Email: ${data.get("email") || ""}`,
      `Phone: ${data.get("phone") || ""}`,
      `Delivery pincode: ${data.get("pincode") || ""}`,
      ``,
      String(data.get("message") || ""),
      ``,
    ].join("\n");

    window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;

    setSent(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" name="name" required autoComplete="name" />
        <Field
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
        <Field label="Phone" name="phone" type="tel" autoComplete="tel" />
        <Field
          label="Delivery pincode"
          name="pincode"
          inputMode="numeric"
          autoComplete="postal-code"
        />
      </div>

      <Field label="Subject" name="subject" required />

      <div>
        <label
          htmlFor="message"
          className="label block text-cream-faint"
        >
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          placeholder="What are you looking for? Headcount, room size and budget all help."
          className="mt-2 w-full rounded-plate border border-edge bg-surface px-4 py-3 text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit">Send enquiry</Button>
        {sent ? (
          <p role="status" className="text-sm text-good">
            Opening your email app. If nothing happened, write to us directly.
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  ...props
}: React.ComponentProps<"input"> & { label: string; name: string }) {
  return (
    <div>
      <label htmlFor={name} className="label block text-cream-faint">
        {label}
      </label>
      <input
        {...props}
        id={name}
        name={name}
        className="mt-2 w-full rounded-plate border border-edge bg-surface px-4 py-3 text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
      />
    </div>
  );
}
