import { loadIndex } from "../../../../lib/loadIndex";
import { resolveDraft, resolveZip } from "../../../../lib/resolve";
import { handleSummaryGet, type SummaryEnv } from "../../../../lib/summary";
import { cloudflareEnv } from "../../../../lib/cloudflareEnv";

async function loadEnv(): Promise<SummaryEnv> {
  return cloudflareEnv<SummaryEnv>();
}

async function loadZip(id: string) {
  const index = loadIndex();
  const zip =
    index.zips.find((entry) => entry.id === id) ??
    resolveZip(index, id) ??
    resolveDraft(index, id);
  if (!zip) return null;
  return {
    title: zip.title,
    body: zip.body,
    snapshotSha: index.snapshot.sha,
    bodySource: zip.bodySource,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return handleSummaryGet(id, await loadEnv(), loadZip);
}
