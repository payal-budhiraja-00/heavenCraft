import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/**
 * Tells the host that the submissions in the last ingest are safely in a
 * branch, so it can drop them.
 *
 * Split out of `submissions:ingest` on purpose. The ingest writes files into
 * a checkout that is thrown away if any later step fails, so deleting the
 * originals at that point would destroy a client's photographs on the word of
 * a job that had not yet proved it could build, commit or push. This runs
 * last, when there is a branch to point at.
 *
 * Re-running is harmless: the endpoint answers the same way for a draft it has
 * already removed.
 */

const ENDPOINT = process.env.SUBMIT_ENDPOINT ?? "";
const COLLECT_KEY = process.env.SUBMIT_COLLECT_KEY ?? "";

const RECEIPT = join(import.meta.dirname, "..", "..", "submissions-ingested.json");

async function main() {
  if (!ENDPOINT || !COLLECT_KEY) {
    throw new Error("SUBMIT_ENDPOINT and SUBMIT_COLLECT_KEY must both be set.");
  }

  if (!existsSync(RECEIPT)) {
    console.log("No receipt from an ingest; nothing to release.");
    return;
  }

  const { ingested } = JSON.parse(readFileSync(RECEIPT, "utf8")) as {
    ingested: { id: string; name: string }[];
  };

  for (const draft of ingested) {
    const body = new FormData();
    body.set("action", "done");
    body.set("collect_key", COLLECT_KEY);
    body.set("draft", draft.id);

    const res = await fetch(ENDPOINT, { method: "POST", body });
    if (!res.ok) {
      // Worth reporting, not worth failing: the branch already exists and the
      // draft will simply be offered again next run, where the handle clash
      // check will skip it.
      console.warn(`Could not release ${draft.name}: HTTP ${res.status}`);
      continue;
    }
    console.log(`Released ${draft.name}`);
  }

  unlinkSync(RECEIPT);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
