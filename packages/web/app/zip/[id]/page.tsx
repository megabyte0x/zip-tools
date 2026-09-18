import { notFound } from "next/navigation";
import { ReaderBody } from "../../../components/ReaderBody";
import { ZipMeta } from "../../../components/ZipMeta";
import { loadIndex } from "../../../lib/loadIndex";
import { resolveZip } from "../../../lib/resolve";

export default async function ZipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const zip = resolveZip(loadIndex(), id);
  if (!zip) notFound();
  return (
    <article>
      <h1>{zip.title}</h1>
      <ZipMeta zip={zip} />
      <ReaderBody body={zip.body} bodyKind={zip.bodyKind} officialUrl={zip.officialUrl} />
    </article>
  );
}
