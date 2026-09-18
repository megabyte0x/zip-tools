import { notFound } from "next/navigation";
import { CitationGraph } from "../../../components/CitationGraph";
import { ReaderBody } from "../../../components/ReaderBody";
import { ReaderShell } from "../../../components/ReaderShell";
import { loadIndex } from "../../../lib/loadIndex";
import { neighborhood } from "../../../lib/neighborhood";
import { prevNext } from "../../../lib/neighbors";
import { resolveZip } from "../../../lib/resolve";

export default async function ZipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const index = loadIndex();
  const zip = resolveZip(index, id);
  if (!zip) notFound();
  const neighbors =
    zip.number != null ? prevNext(index.zips, zip.number) : { prev: null, next: null };
  return (
    <ReaderShell zip={zip} prev={neighbors.prev} next={neighbors.next}>
      <ReaderBody body={zip.body} bodyKind={zip.bodyKind} officialUrl={zip.officialUrl} />
      {zip.number != null ? (
        <CitationGraph
          center={zip.number}
          depth1={neighborhood(index, zip.number, 1)}
          depth2={neighborhood(index, zip.number, 2)}
        />
      ) : null}
    </ReaderShell>
  );
}
