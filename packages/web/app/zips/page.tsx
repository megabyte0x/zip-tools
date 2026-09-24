import type { Metadata } from "next";
import { ZipExplorer } from "../../components/ZipExplorer";
import { loadIndex } from "../../lib/loadIndex";
import { pageMetadata } from "../../lib/pageMetadata";
import { parseZipsQuery } from "../../lib/zipsQuery";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const drafts = (await searchParams).kind === "draft";
  return pageMetadata(
    drafts
      ? { title: "Draft ZIPs", description: "Unnumbered draft Zcash Improvement Proposals in the pinned snapshot." }
      : { title: "Browse ZIPs", description: "Search and filter every Zcash Improvement Proposal by status, category, and network upgrade." },
  );
}

function searchParamsToQuery(searchParams: Record<string, string | string[] | undefined>): string {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") p.set(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) p.append(key, item);
    }
  }
  return p.toString();
}

export default async function ZipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { zips } = loadIndex();
  const parsed = parseZipsQuery(searchParamsToQuery(await searchParams));
  return (
    <ZipExplorer
      zips={zips.map((zip) => ({ ...zip, body: null }))}
      initialQuery={parsed}
    />
  );
}
