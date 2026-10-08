import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getInfoPage, REPOSITORY } from "../../lib/siteInfo";
import { pageMetadata } from "../../lib/pageMetadata";

export async function generateMetadata({ params }: { params: Promise<{ info: string }> }): Promise<Metadata> {
  const { info } = await params;
  const page = getInfoPage(info);
  if (!page) return { title: "Page not found" };
  return pageMetadata({ title: page.title, description: page.paragraphs[0].slice(0, 200), path: `/${info}` });
}

export default async function InfoPage({ params }: { params: Promise<{ info: string }> }) {
  const { info } = await params;
  const page = getInfoPage(info);
  if (!page) notFound();
  return (
    <article style={{ maxWidth: "72ch", margin: "2rem auto", padding: "0 1.5rem", lineHeight: 1.8 }}>
      <h1>{page.title}</h1>
      {page.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      <p><a href={`${REPOSITORY}/issues`}>Repository and issue tracker</a> · <a href="/zips">Browse proposals</a> · <a href="/llms.txt">Agent discovery guide</a> · <a href="/openapi.json">Supporting API contract</a></p>
    </article>
  );
}
