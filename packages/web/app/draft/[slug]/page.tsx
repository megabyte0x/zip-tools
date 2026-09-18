import { notFound } from "next/navigation";
import { CitationGraph } from "../../../components/CitationGraph";
import { ReaderBody } from "../../../components/ReaderBody";
import { ZipMeta } from "../../../components/ZipMeta";
import { loadIndex } from "../../../lib/loadIndex";
import { neighborhood } from "../../../lib/neighborhood";
import { resolveDraft } from "../../../lib/resolve";

export default async function DraftPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const index = loadIndex();
  const zip = resolveDraft(index, slug);
  if (!zip) notFound();
  return (
    <article>
      <h1>{zip.title}</h1>
      <ZipMeta zip={zip} />
      <ReaderBody body={zip.body} bodyKind={zip.bodyKind} officialUrl={zip.officialUrl} />
      {zip.number != null ? (
        <CitationGraph
          center={zip.number}
          depth1={neighborhood(index, zip.number, 1)}
          depth2={neighborhood(index, zip.number, 2)}
        />
      ) : null}
    </article>
  );
}
