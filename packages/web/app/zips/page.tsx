import { ZipExplorer } from "../../components/ZipExplorer";
import { loadIndex } from "../../lib/loadIndex";
import { parseZipsQuery } from "../../lib/zipsQuery";
import styles from "./page.module.css";

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
    <div className={styles.page}>
      <h1 className={styles.heading}>Browse proposals</h1>
      {/* A link that changes the query (header Drafts, Back) remounts the explorer from the URL. */}
      <ZipExplorer
        key={JSON.stringify(parsed)}
        zips={zips.map((zip) => ({ ...zip, body: null }))}
        initialQuery={parsed}
      />
    </div>
  );
}
