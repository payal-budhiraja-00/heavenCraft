"use client";

import { useState } from "react";
import { Button } from "./ui";
import { SITE } from "@/lib/site";

type State = "idle" | "sending" | "sent" | "error";

/**
 * The enquiry form.
 *
 * This is a static export, but the host runs PHP, so the form posts to a small
 * endpoint that hands the message to the server's local mail queue. That
 * endpoint holds no credentials -- every outbound SMTP port here is firewalled
 * and the local relay needs no authentication -- so there is nothing to leak.
 *
 * If the request fails for any reason the mailto: the form used to rely on is
 * offered instead, so a visitor never reaches a dead end.
 */
export function ContactForm() {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);

  function composeMailto(data: FormData) {
    const body = [
      `Name: ${data.get("name") || ""}`,
      `Email: ${data.get("email") || ""}`,
      `Phone: ${data.get("phone") || ""}`,
      `Delivery pincode: ${data.get("pincode") || ""}`,
      "",
      String(data.get("message") || ""),
      "",
    ].join("\n");

    const subject = String(data.get("subject") || "Website enquiry");
    return `mailto:${SITE.email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setState("sending");
    setError(null);
    setFallback(null);

    try {
      const res = await fetch("/enquiry.php", { method: "POST", body: data });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (res.ok && payload?.ok) {
        setState("sent");
        form.reset();
        return;
      }

      setState("error");
      setError(payload?.error ?? "The message could not be sent.");
      setFallback(composeMailto(data));
    } catch {
      setState("error");
      setError("The message could not be sent.");
      setFallback(composeMailto(data));
    }
  }

  if (state === "sent") {
    return (
      <div
        role="status"
        className="rounded-panel border border-edge bg-surface p-6"
      >
        <p className="text-base font-semibold text-cream">
          Thanks — that reached us.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-cream-muted">
          We reply to enquiries the same working day, usually within a few
          hours. If you need us sooner, write to{" "}
          <a
            href={`mailto:${SITE.email}`}
            className="text-gold transition-colors hover:text-gold-bright"
          >
            {SITE.email}
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-5 text-sm text-gold transition-colors hover:text-gold-bright"
        >
          Send another
        </button>
      </div>
    );
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
        <label htmlFor="message" className="label block text-cream-faint">
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

      {/*
        Bots complete every field they can find. This one is removed from the
        layout, hidden from assistive tech and skipped in the tab order, so no
        real visitor ever fills it in.
      */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send enquiry"}
        </Button>

        {state === "error" ? (
          <p role="alert" className="text-sm text-cream-muted">
            {error}{" "}
            {fallback ? (
              <a
                href={fallback}
                className="text-gold transition-colors hover:text-gold-bright"
              >
                Send it by email instead
              </a>
            ) : null}
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
