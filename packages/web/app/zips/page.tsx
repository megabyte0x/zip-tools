import { ZipExplorer } from "../../components/ZipExplorer";
import { loadIndex } from "../../lib/loadIndex";
import { parseZipsQuery } from "../../lib/zipsQuery";

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
      key={`${parsed.text}:${parsed.kind}`}
      zips={zips}
      initialText={parsed.text}
      initialKind={parsed.kind}
    />
  );
}
