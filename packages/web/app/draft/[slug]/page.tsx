import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CitationGraph } from "../../../components/CitationGraph";
import { ReaderBody } from "../../../components/ReaderBody";
import { ReaderShell } from "../../../components/ReaderShell";
import { ViewBeacon } from "../../../components/ViewBeacon";
import { cloudflareEnv } from "../../../lib/cloudflareEnv";
import { loadIndex } from "../../../lib/loadIndex";
import { neighborhood } from "../../../lib/neighborhood";
import { pageMetadata, zipPageDescription, zipPageTitle } from "../../../lib/pageMetadata";
import { prepareReader } from "../../../lib/prepareReader";
import { resolveDraft } from "../../../lib/resolve";
import { isSummaryEnabled, type SummaryEnv } from "../../../lib/summary";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const zip = resolveDraft(loadIndex(), slug);
  if (!zip) return { title: "Draft not found" };
  return pageMetadata({ title: zipPageTitle(zip), description: zipPageDescription(zip) });
}

export default async function DraftPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const index = loadIndex();
  const zip = resolveDraft(index, slug);
  if (!zip) notFound();
  const document = await prepareReader(zip);
  const summaryEnabled = isSummaryEnabled(await cloudflareEnv<SummaryEnv>());
  return (
    <ReaderShell zip={zip} prev={null} next={null} document={document} summaryEnabled={summaryEnabled}>
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
        />
      ) : null}
    </ReaderShell>
  );
}
