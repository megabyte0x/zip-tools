import { paginateReader, partHref } from "../../../lib/agentDocuments";
import { ReaderParts } from "../../../components/ReaderParts";
import { zipHref } from "../../../lib/zipHref";
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ part?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const zip = resolveDraft(loadIndex(), slug);
  if (!zip) return { title: "Draft not found" };
  const query = await searchParams;
  return pageMetadata({ title: zipPageTitle(zip), description: zipPageDescription(zip), path: partHref(zipHref(zip), Number(query.part) || 1) });
}

export default async function DraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ part?: string }>;
}) {
  const { slug } = await params;
  const index = loadIndex();
  const zip = resolveDraft(index, slug);
  if (!zip) notFound();
  const parts = paginateReader(await prepareReader(zip), zipHref(zip));
  const selected = Number((await searchParams).part ?? 1);
  if (!Number.isInteger(selected) || selected < 1 || selected > parts.length) notFound();
  const document = parts[selected - 1];
  const summaryEnabled = isSummaryEnabled(await cloudflareEnv<SummaryEnv>());
  return (
    <ReaderShell zip={zip} prev={null} next={null} document={document} summaryEnabled={summaryEnabled}>
      <ReaderParts href={zipHref(zip)} count={parts.length} selected={selected} />
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
