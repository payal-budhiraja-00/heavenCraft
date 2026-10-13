"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui";

/*
 * The product submission form.
 *
 * WHO THIS IS FOR
 *
 * Whoever is holding the supplier's spec sheet and the photographs, which is
 * usually not whoever has a git checkout. Everything the catalogue needs is
 * asked for here, once, while that person still has the sheet in front of
 * them -- because the alternative is what happened with the Atlas chair,
 * where a listing was created with four phone photos and nothing else, and
 * the missing half was never going to be reconstructed later.
 *
 * WHY IT IS STRICT
 *
 * The product page renders features, a specification table and a gallery. A
 * product that arrives without them renders as a page with empty sections,
 * and no amount of downstream tooling can invent the contents. So the form
 * refuses to submit rather than accepting a half-filled one. The same rules
 * are enforced again server-side, because a disabled button is a courtesy,
 * not a control.
 *
 * WHY PHOTOS ARE RESIZED HERE
 *
 * Phone photographs run to several megabytes each and shared hosting caps
 * the size of a single request. Downscaling in the browser to the widest
 * size the site's image ladder actually uses keeps every upload small, and
 * incidentally normalises the EXIF rotation that makes phone photos arrive
 * on their side.
 */

const ENDPOINT =
  process.env.NEXT_PUBLIC_SUBMIT_ENDPOINT || "/submit-product.php";

/** Matches IMAGE_WIDTHS' top rung in src/lib/image-opt.ts. Anything larger is
 *  downscaled before it is ever displayed, so uploading it wastes the
 *  submitter's data allowance and the host's disk. */
const MAX_EDGE = 1600;

/** Mirrors MIN_IMAGE_EDGE in public/submit-product.php. */
const MIN_EDGE = 500;

const MIN_FEATURES = 3;
const MIN_SPECS = 3;
const MIN_PHOTOS = 3;
const MIN_DESCRIPTION = 40;

const DRAFT_STORAGE_KEY = "heavencraft:product-draft";

export type RangeOption = { slug: string; name: string };
export type CategoryOption = {
  value: string;
  label: string;
  ranges: RangeOption[];
};

type Keyed = { key: string };
type FeatureRow = Keyed & { title: string; detail: string };
type SpecRow = Keyed & { label: string; value: string };
type TextRow = Keyed & { value: string };
type Photo = Keyed & {
  /** The name the server gave it. Absent until the upload lands. */
  name?: string;
  preview: string;
  status: "uploading" | "done" | "error";
  error?: string;
};
type ColourRow = Keyed & { colour: string; photos: Photo[] };

type Draft = {
  name: string;
  shortName: string;
  category: string;
  rangeSlug: string;
  rangeName: string;
  description: string;
  price: string;
  mrp: string;
  inStock: boolean;
  features: FeatureRow[];
  specifications: SpecRow[];
  materials: TextRow[];
  inTheBox: TextRow[];
  colours: ColourRow[];
};

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const blankFeature = (): FeatureRow => ({ key: newKey(), title: "", detail: "" });
const blankSpec = (): SpecRow => ({ key: newKey(), label: "", value: "" });
const blankText = (): TextRow => ({ key: newKey(), value: "" });
const blankColour = (): ColourRow => ({ key: newKey(), colour: "", photos: [] });

function emptyDraft(): Draft {
  return {
    name: "",
    shortName: "",
    category: "",
    rangeSlug: "",
    rangeName: "",
    description: "",
    price: "",
    mrp: "",
    inStock: true,
    features: [blankFeature(), blankFeature(), blankFeature()],
    specifications: [blankSpec(), blankSpec(), blankSpec()],
    materials: [blankText()],
    inTheBox: [],
    colours: [blankColour()],
  };
}

/** 24 hex characters, which is what the endpoint's draft pattern accepts. */
function newDraftId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function ProductSubmissionForm({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  /*
   * Generated at unlock rather than on mount. The id is only needed once a
   * photograph is uploaded, which cannot happen before the code is accepted,
   * and deferring it keeps crypto.getRandomValues out of the static export's
   * prerender -- where it would run at build time, on the server, to produce
   * a value every visitor then discards.
   */
  const draftId = useRef<string>("");

  /*
   * Typed answers are restored after an accidental reload. Photographs are
   * not: they already live on the server under a draft id this session has
   * forgotten, so re-picking them is both simpler and correct. The access
   * code is never stored.
   *
   * Restored at unlock rather than in a mount effect. The form does not exist
   * until the code is accepted, so there is nothing to restore into before
   * then, and doing it here avoids a setState during an effect that would
   * render the blank form first and then replace it.
   */
  function restoreDraft() {
    try {
      const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<Draft>;
      setDraft((current) => ({
        ...current,
        ...parsed,
        colours: (parsed.colours ?? current.colours).map((c) => ({
          ...c,
          photos: [],
        })),
      }));
    } catch {
      // A corrupt draft is not worth surfacing; the blank form is the fallback.
    }
  }

  useEffect(() => {
    if (!unlocked || sent) return;
    try {
      const { colours, ...rest } = draft;
      window.localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          ...rest,
          colours: colours.map(({ key, colour }) => ({
            key,
            colour,
            photos: [],
          })),
        }),
      );
    } catch {
      // Private browsing and full quotas both land here. Losing the backup is
      // survivable; losing the form to an exception is not.
    }
  }, [draft, sent, unlocked]);

  const set = useCallback(<K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [field]: value }));
  }, []);

  const ranges = useMemo(
    () => categories.find((c) => c.value === draft.category)?.ranges ?? [],
    [categories, draft.category],
  );

  const problems = useMemo(() => validate(draft), [draft]);
  const uploading = draft.colours.some((c) =>
    c.photos.some((p) => p.status === "uploading"),
  );

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setChecking(true);
    setLockError(null);
    try {
      const body = new FormData();
      body.set("action", "ping");
      body.set("key", accessCode);
      const res = await fetch(ENDPOINT, { method: "POST", body });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (res.ok && payload?.ok) {
        draftId.current = newDraftId();
        restoreDraft();
        setUnlocked(true);
      } else {
        setLockError(payload?.error ?? "That access code was not recognised.");
      }
    } catch {
      setLockError("Could not reach the server. Check your connection.");
    } finally {
      setChecking(false);
    }
  }

  async function addPhotos(colourKey: string, files: FileList | null) {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const key = newKey();
      let resized: { blob: Blob; width: number; height: number };

      try {
        resized = await downscale(file);
      } catch {
        setDraft((d) => withPhoto(d, colourKey, {
          key,
          preview: "",
          status: "error",
          error: "That file could not be read as an image.",
        }));
        continue;
      }

      if (resized.width < MIN_EDGE || resized.height < MIN_EDGE) {
        setDraft((d) => withPhoto(d, colourKey, {
          key,
          preview: URL.createObjectURL(resized.blob),
          status: "error",
          error: `Too small (${resized.width}×${resized.height}). We need at least ${MIN_EDGE}px on each side.`,
        }));
        continue;
      }

      setDraft((d) => withPhoto(d, colourKey, {
        key,
        preview: URL.createObjectURL(resized.blob),
        status: "uploading",
      }));

      try {
        const body = new FormData();
        body.set("action", "image");
        body.set("key", accessCode);
        body.set("draft", draftId.current);
        body.append("image", resized.blob, "photo.jpg");

        const res = await fetch(ENDPOINT, { method: "POST", body });
        const payload = (await res.json().catch(() => null)) as {
          ok?: boolean;
          image?: string;
          error?: string;
        } | null;

        if (res.ok && payload?.ok && payload.image) {
          setDraft((d) =>
            patchPhoto(d, colourKey, key, {
              status: "done",
              name: payload.image,
            }),
          );
        } else {
          setDraft((d) =>
            patchPhoto(d, colourKey, key, {
              status: "error",
              error: payload?.error ?? "That photo did not upload.",
            }),
          );
        }
      } catch {
        setDraft((d) =>
          patchPhoto(d, colourKey, key, {
            status: "error",
            error: "That photo did not upload. Check your connection.",
          }),
        );
      }
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (problems.length > 0 || uploading) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const body = new FormData();
      body.set("action", "submit");
      body.set("key", accessCode);
      body.set("draft", draftId.current);
      body.set("payload", JSON.stringify(toPayload(draft)));

      const res = await fetch(ENDPOINT, { method: "POST", body });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (res.ok && payload?.ok) {
        try {
          window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          // Nothing to do; the success screen is what matters.
        }
        setSent(true);
      } else {
        setSubmitError(payload?.error ?? "That could not be sent.");
      }
    } catch {
      setSubmitError("Could not reach the server. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-panel border border-edge bg-surface p-6"
      >
        <p className="text-base font-semibold text-cream">
          Sent — thank you.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-cream-muted">
          The product and its photographs are with us. Someone will check the
          details and put it on the site; it does not go live automatically.
        </p>
        <button
          type="button"
          onClick={() => {
            draftId.current = newDraftId();
            setDraft(emptyDraft());
            setShowErrors(false);
            setSent(false);
          }}
          className="mt-5 text-sm text-gold transition-colors hover:text-gold-bright"
        >
          Submit another product
        </button>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <form
        onSubmit={unlock}
        className="max-w-md rounded-panel border border-edge bg-surface p-6"
      >
        <label htmlFor="access" className="label block text-cream-faint">
          Access code
        </label>
        <input
          id="access"
          name="access"
          type="password"
          autoComplete="off"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          required
          className="mt-2 w-full rounded-plate border border-edge bg-base px-4 py-3 text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
        />
        <p className="mt-3 text-sm leading-relaxed text-cream-faint">
          This form is for HeavenCraft staff and suppliers. Ask us for the code
          if you need one.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={checking || accessCode === ""}>
            {checking ? "Checking…" : "Continue"}
          </Button>
          {lockError ? (
            <p role="alert" className="text-sm text-cream-muted">
              {lockError}
            </p>
          ) : null}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-14" noValidate>
      <Section
        title="The product"
        hint="As it should read on the site."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Text
            label="Full name"
            value={draft.name}
            onChange={(v) => {
              setDraft((d) => ({
                ...d,
                name: v,
                // Pre-filled from the first word, which is right for every
                // product in the range today ("Luxor Performance Mesh Chair"
                // is shown as "Luxor"), and stays editable for the ones it
                // will not be right for.
                shortName:
                  d.shortName === "" || d.shortName === d.name.split(" ")[0]
                    ? v.split(" ")[0] ?? ""
                    : d.shortName,
              }));
            }}
            placeholder="Atlas Performance Mesh Chair"
          />
          <Text
            label="Short name"
            value={draft.shortName}
            onChange={(v) => set("shortName", v)}
            placeholder="Atlas"
            hint="Used as the page heading, where the category is already on screen."
          />
          <Select
            label="Category"
            value={draft.category}
            onChange={(v) => setDraft((d) => ({ ...d, category: v, rangeSlug: "", rangeName: "" }))}
            options={[
              { value: "", label: "Choose one" },
              ...categories.map((c) => ({ value: c.value, label: c.label })),
            ]}
          />
          <div>
            <Select
              label="Range"
              value={draft.rangeSlug}
              disabled={draft.category === ""}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  rangeSlug: v,
                  rangeName:
                    v === "__new"
                      ? ""
                      : ranges.find((r) => r.slug === v)?.name ?? "",
                }))
              }
              options={[
                { value: "", label: draft.category === "" ? "Pick a category first" : "Choose one" },
                ...ranges.map((r) => ({ value: r.slug, label: r.name })),
                { value: "__new", label: "A new range…" },
              ]}
            />
            {draft.rangeSlug === "__new" ? (
              <input
                value={draft.rangeName}
                onChange={(e) => set("rangeName", e.target.value)}
                placeholder="Performance Mesh Chairs"
                aria-label="New range name"
                className="mt-3 w-full rounded-plate border border-edge bg-base px-4 py-3 text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
              />
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="description" className="label block text-cream-faint">
            Description
          </label>
          <textarea
            id="description"
            rows={5}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What it is, who it suits, and the one thing that makes it different from the chair next to it."
            className="mt-2 w-full rounded-plate border border-edge bg-base px-4 py-3 text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
          />
          <Counter
            now={draft.description.trim().length}
            min={MIN_DESCRIPTION}
            unit="characters"
          />
        </div>
      </Section>

      <Section title="Price" hint="In rupees, without symbols or commas.">
        <div className="grid gap-5 sm:grid-cols-3">
          <Text
            label="Selling price"
            value={draft.price}
            onChange={(v) => set("price", v.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="16999"
          />
          <Text
            label="MRP (optional)"
            value={draft.mrp}
            onChange={(v) => set("mrp", v.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="26999"
            hint="Shown struck through. Leave blank if there is no discount."
          />
          <div className="flex items-end pb-1">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-cream">
              <input
                type="checkbox"
                checked={draft.inStock}
                onChange={(e) => set("inStock", e.target.checked)}
                className="h-4 w-4 accent-gold"
              />
              In stock
            </label>
          </div>
        </div>
      </Section>

      <Section
        title="Features"
        hint={`Copy them from the supplier's sheet. At least ${MIN_FEATURES}.`}
      >
        <Repeatable
          rows={draft.features}
          onChange={(rows) => set("features", rows)}
          create={blankFeature}
          addLabel="Add a feature"
          min={MIN_FEATURES}
          render={(row, update) => (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <input
                value={row.title}
                onChange={(e) => update({ ...row, title: e.target.value })}
                placeholder="4D adjustable armrests"
                aria-label="Feature heading"
                className="w-full rounded-plate border border-edge bg-base px-4 py-3 text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
              />
              <input
                value={row.detail}
                onChange={(e) => update({ ...row, detail: e.target.value })}
                placeholder="Height, depth, width and pivot (optional)"
                aria-label="Feature detail"
                className="w-full rounded-plate border border-edge bg-base px-4 py-3 text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
              />
            </div>
          )}
        />
      </Section>

      <Section
        title="Specifications"
        hint={`The measured figures, exactly as printed. At least ${MIN_SPECS}.`}
      >
        <Repeatable
          rows={draft.specifications}
          onChange={(rows) => set("specifications", rows)}
          create={blankSpec}
          addLabel="Add a specification"
          min={MIN_SPECS}
          render={(row, update) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={row.label}
                onChange={(e) => update({ ...row, label: e.target.value })}
                placeholder="Seat height"
                aria-label="Specification label"
                className="w-full rounded-plate border border-edge bg-base px-4 py-3 text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
              />
              <input
                value={row.value}
                onChange={(e) => update({ ...row, value: e.target.value })}
                placeholder="46-56 cm"
                aria-label="Specification value"
                className="w-full rounded-plate border border-edge bg-base px-4 py-3 text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
              />
            </div>
          )}
        />
      </Section>

      <Section title="Materials" hint="Optional. One per line.">
        <Repeatable
          rows={draft.materials}
          onChange={(rows) => set("materials", rows)}
          create={blankText}
          addLabel="Add a material"
          min={0}
          render={(row, update) => (
            <input
              value={row.value}
              onChange={(e) => update({ ...row, value: e.target.value })}
              placeholder="Powder-coated steel frame"
              aria-label="Material"
              className="w-full rounded-plate border border-edge bg-base px-4 py-3 text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
            />
          )}
        />
      </Section>

      <Section
        title="In the box"
        hint="Optional. Only where it ships as a kit with countable parts."
      >
        <Repeatable
          rows={draft.inTheBox}
          onChange={(rows) => set("inTheBox", rows)}
          create={blankText}
          addLabel="Add an item"
          min={0}
          render={(row, update) => (
            <input
              value={row.value}
              onChange={(e) => update({ ...row, value: e.target.value })}
              placeholder="6 × hooks"
              aria-label="Box contents"
              className="w-full rounded-plate border border-edge bg-base px-4 py-3 text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
            />
          )}
        />
      </Section>

      <Section
        title="Colours and photographs"
        hint={`One block per colourway, each with at least ${MIN_PHOTOS} photographs. Shoot the whole chair, straight on, against a plain wall.`}
      >
        <div className="space-y-6">
          {draft.colours.map((colour, index) => (
            <div
              key={colour.key}
              className="rounded-panel border border-edge bg-surface p-5"
            >
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={`colour-${colour.key}`}
                    className="label block text-cream-faint"
                  >
                    Colour {index + 1}
                  </label>
                  <input
                    id={`colour-${colour.key}`}
                    value={colour.colour}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        colours: d.colours.map((c) =>
                          c.key === colour.key
                            ? { ...c, colour: e.target.value }
                            : c,
                        ),
                      }))
                    }
                    placeholder="Black-Dark Grey"
                    className="mt-2 w-full rounded-plate border border-edge bg-base px-4 py-3 text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
                  />
                </div>
                {draft.colours.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        colours: d.colours.filter((c) => c.key !== colour.key),
                      }))
                    }
                    className="min-h-11 px-3 text-sm text-cream-faint transition-colors hover:text-gold"
                  >
                    Remove colour
                  </button>
                ) : null}
              </div>

              {colour.photos.length > 0 ? (
                <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {colour.photos.map((photo) => (
                    <li key={photo.key} className="relative">
                      <div className="relative aspect-square overflow-hidden rounded-plate border border-edge bg-base">
                        {photo.preview ? (
                          // Local object URLs, never part of the build, so
                          // next/image's loader has nothing to do here.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo.preview}
                            alt=""
                            className={`h-full w-full object-cover ${
                              photo.status === "done" ? "" : "opacity-40"
                            }`}
                          />
                        ) : null}
                        {photo.status === "uploading" ? (
                          <span className="absolute inset-0 flex items-center justify-center text-xs text-cream">
                            Uploading…
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            colours: d.colours.map((c) =>
                              c.key === colour.key
                                ? {
                                    ...c,
                                    photos: c.photos.filter(
                                      (p) => p.key !== photo.key,
                                    ),
                                  }
                                : c,
                            ),
                          }))
                        }
                        className="mt-2 block w-full text-center text-xs text-cream-faint transition-colors hover:text-gold"
                      >
                        Remove
                      </button>
                      {photo.status === "error" ? (
                        <p className="mt-1 text-xs leading-snug text-gold">
                          {photo.error}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              <label className="mt-5 inline-flex min-h-11 cursor-pointer items-center rounded-plate border border-edge-strong bg-raised px-5 py-3 text-sm font-semibold text-cream transition-colors hover:border-gold hover:text-gold">
                Add photographs
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    void addPhotos(colour.key, e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <Counter
                now={colour.photos.filter((p) => p.status === "done").length}
                min={MIN_PHOTOS}
                unit="photographs"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setDraft((d) => ({ ...d, colours: [...d.colours, blankColour()] }))
          }
          className="mt-5 min-h-11 text-sm text-gold transition-colors hover:text-gold-bright"
        >
          Add another colour
        </button>
      </Section>

      <div className="border-t border-edge pt-8">
        {showErrors && problems.length > 0 ? (
          <div
            role="alert"
            className="mb-6 rounded-panel border border-edge bg-surface p-5"
          >
            <p className="text-sm font-semibold text-cream">
              Still needed before this can be sent
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-cream-muted">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={submitting || uploading}>
            {submitting
              ? "Sending…"
              : uploading
                ? "Waiting for photos…"
                : "Send this product"}
          </Button>
          {submitError ? (
            <p role="alert" className="text-sm text-cream-muted">
              {submitError}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}

/* ---------- helpers ---------- */

function withPhoto(draft: Draft, colourKey: string, photo: Photo): Draft {
  return {
    ...draft,
    colours: draft.colours.map((c) =>
      c.key === colourKey ? { ...c, photos: [...c.photos, photo] } : c,
    ),
  };
}

function patchPhoto(
  draft: Draft,
  colourKey: string,
  photoKey: string,
  patch: Partial<Photo>,
): Draft {
  return {
    ...draft,
    colours: draft.colours.map((c) =>
      c.key === colourKey
        ? {
            ...c,
            photos: c.photos.map((p) =>
              p.key === photoKey ? { ...p, ...patch } : p,
            ),
          }
        : c,
    ),
  };
}

/**
 * Reads the file, honours its EXIF rotation, and redraws it no larger than
 * the widest size the site serves.
 *
 * `imageOrientation: "from-image"` is the part that matters for phone
 * photographs: without it a portrait shot taken on a phone arrives rotated,
 * because the sensor wrote it landscape and left a rotation flag behind.
 */
async function downscale(
  file: File,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D context.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.85);
  });
  if (!blob) throw new Error("Could not encode the image.");

  return { blob, width, height };
}

/**
 * Mirrors validate() in public/submit-product.php.
 *
 * Both exist on purpose. This one is here so the submitter is told what is
 * missing while they can still fix it; the server's copy is the one that
 * actually decides, because anything in the browser can be bypassed.
 */
function validate(d: Draft): string[] {
  const problems: string[] = [];

  if (d.name.trim().length < 3) problems.push("A product name.");
  if (d.shortName.trim() === "") problems.push("A short name.");
  if (d.category === "") problems.push("A category.");
  if (d.rangeSlug === "" || (d.rangeSlug === "__new" && d.rangeName.trim() === "")) {
    problems.push("A range.");
  }
  if (d.description.trim().length < MIN_DESCRIPTION) {
    problems.push(`A description of at least ${MIN_DESCRIPTION} characters.`);
  }
  if (d.price === "" || Number(d.price) <= 0) problems.push("A selling price.");
  if (d.mrp !== "" && Number(d.mrp) < Number(d.price)) {
    problems.push("An MRP at or above the selling price.");
  }

  const features = d.features.filter((f) => f.title.trim() !== "");
  if (features.length < MIN_FEATURES) {
    problems.push(`At least ${MIN_FEATURES} features (${features.length} so far).`);
  }

  const specs = d.specifications.filter(
    (s) => s.label.trim() !== "" && s.value.trim() !== "",
  );
  if (specs.length < MIN_SPECS) {
    problems.push(
      `At least ${MIN_SPECS} complete specifications (${specs.length} so far).`,
    );
  }

  d.colours.forEach((colour, index) => {
    const label = colour.colour.trim() || `colour ${index + 1}`;
    if (colour.colour.trim() === "") problems.push(`A name for ${label}.`);
    const ready = colour.photos.filter((p) => p.status === "done").length;
    if (ready < MIN_PHOTOS) {
      problems.push(
        `At least ${MIN_PHOTOS} photographs for ${label} (${ready} so far).`,
      );
    }
    if (colour.photos.some((p) => p.status === "error")) {
      problems.push(`A photograph for ${label} did not upload.`);
    }
  });

  return problems;
}

function toPayload(d: Draft) {
  const slugify = (s: string) =>
    s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const rangeName = d.rangeSlug === "__new" ? d.rangeName.trim() : d.rangeName;

  return {
    name: d.name.trim(),
    shortName: d.shortName.trim(),
    category: d.category,
    subCategory:
      d.rangeSlug === "__new" ? slugify(rangeName) : d.rangeSlug,
    subName: rangeName,
    description: d.description.trim(),
    price: Number(d.price),
    mrp: d.mrp === "" ? null : Number(d.mrp),
    inStock: d.inStock,
    features: d.features
      .filter((f) => f.title.trim() !== "")
      .map((f) => ({ title: f.title.trim(), detail: f.detail.trim() })),
    specifications: d.specifications
      .filter((s) => s.label.trim() !== "" && s.value.trim() !== "")
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() })),
    materials: d.materials
      .map((m) => m.value.trim())
      .filter((v) => v !== ""),
    inTheBox: d.inTheBox.map((i) => i.value.trim()).filter((v) => v !== ""),
    variants: d.colours.map((c) => ({
      colour: c.colour.trim(),
      images: c.photos
        .filter((p) => p.status === "done" && p.name)
        .map((p) => p.name as string),
    })),
  };
}

/* ---------- presentational pieces ---------- */

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="type-wide text-xl font-bold text-cream">{title}</h2>
      {hint ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream-faint">
          {hint}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Text({
  label,
  value,
  onChange,
  hint,
  ...props
}: Omit<React.ComponentProps<"input">, "onChange" | "value"> & {
  label: string;
  value: string;
  hint?: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="label block text-cream-faint">
        {label}
      </label>
      <input
        {...props}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-plate border border-edge bg-base px-4 py-3 text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
      />
      {hint ? (
        <p className="mt-2 text-xs leading-relaxed text-cream-faint">{hint}</p>
      ) : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="label block text-cream-faint">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-plate border border-edge bg-base px-4 py-3 text-sm text-cream focus:border-gold focus:outline-none disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Counter({
  now,
  min,
  unit,
}: {
  now: number;
  min: number;
  unit: string;
}) {
  if (min === 0) return null;
  const done = now >= min;
  return (
    <p
      className={`mt-2 text-xs ${done ? "text-cream-faint" : "text-gold"}`}
      aria-live="polite"
    >
      {done ? `${now} ${unit}` : `${now} of ${min} ${unit}`}
    </p>
  );
}

function Repeatable<T extends Keyed>({
  rows,
  onChange,
  create,
  render,
  addLabel,
  min,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  create: () => T;
  render: (row: T, update: (next: T) => void) => React.ReactNode;
  addLabel: string;
  min: number;
}) {
  return (
    <div>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.key} className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {render(row, (next) =>
                onChange(rows.map((r) => (r.key === row.key ? next : r))),
              )}
            </div>
            <button
              type="button"
              aria-label="Remove this row"
              onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
              className="min-h-11 shrink-0 px-2 text-sm text-cream-faint transition-colors hover:text-gold"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => onChange([...rows, create()])}
          className="min-h-11 text-sm text-gold transition-colors hover:text-gold-bright"
        >
          {addLabel}
        </button>
        <Counter now={countFilled(rows)} min={min} unit="filled in" />
      </div>
    </div>
  );
}

function countFilled<T extends Keyed>(rows: T[]): number {
  return rows.filter((row) =>
    Object.entries(row).some(
      ([key, value]) =>
        key !== "key" && typeof value === "string" && value.trim() !== "",
    ),
  ).length;
}
