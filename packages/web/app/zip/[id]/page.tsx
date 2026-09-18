import { notFound } from "next/navigation";
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
      <p>{zip.id}</p>
    </article>
  );
}
