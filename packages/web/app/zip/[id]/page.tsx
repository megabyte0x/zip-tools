import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CitationGraph } from "../../../components/CitationGraph";
import { ReaderBody } from "../../../components/ReaderBody";
import { ReaderShell } from "../../../components/ReaderShell";
import { ViewBeacon } from "../../../components/ViewBeacon";
import { cloudflareEnv } from "../../../lib/cloudflareEnv";
import { loadIndex } from "../../../lib/loadIndex";
import { neighborhood } from "../../../lib/neighborhood";
import { prevNext } from "../../../lib/neighbors";
import { pageMetadata, zipPageDescription, zipPageTitle } from "../../../lib/pageMetadata";
import { prepareReader } from "../../../lib/prepareReader";
import { resolveZip } from "../../../lib/resolve";
import { isSummaryEnabled, type SummaryEnv } from "../../../lib/summary";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const zip = resolveZip(loadIndex(), id);
  if (!zip) return { title: "ZIP not found" };
  return pageMetadata({ title: zipPageTitle(zip), description: zipPageDescription(zip) });
}

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
  const document = await prepareReader(zip);
  const summaryEnabled = isSummaryEnabled(await cloudflareEnv<SummaryEnv>());
  return (
    <ReaderShell
      zip={zip}
      prev={neighbors.prev}
      next={neighbors.next}
      document={document}
      summaryEnabled={summaryEnabled}
    >
      <ViewBeacon id={zip.id} />
      <ReaderBody
        body={zip.body}
        bodyKind={zip.bodyKind}
        officialUrl={zip.officialUrl}
        bodySource={zip.bodySource}
        discussionsTo={zip.discussionsTo}
        document={document}
      />
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
