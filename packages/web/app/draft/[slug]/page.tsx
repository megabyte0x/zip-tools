import { notFound } from "next/navigation";
import { loadIndex } from "../../../lib/loadIndex";
import { resolveDraft } from "../../../lib/resolve";

export default async function DraftPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const zip = resolveDraft(loadIndex(), slug);
  if (!zip) notFound();
  return (
    <article>
      <h1>{zip.title}</h1>
      <p>{zip.id}</p>
    </article>
  );
}
