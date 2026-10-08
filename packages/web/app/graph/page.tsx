import { ForceGraph3D } from "../../components/ForceGraph3D";
import { loadIndex } from "../../lib/loadIndex";
import { browserZip } from "../../lib/browserZip";
import { pageMetadata } from "../../lib/pageMetadata";

export const metadata = pageMetadata({
  path: "/graph",
  title: "Citation graph",
  description: "Interactive 3D map of which Zcash Improvement Proposals cite each other.",
});

export default function GraphPage() {
  const index = loadIndex();
  const zips = index.zips.map(browserZip);
  return <>
    <ForceGraph3D zips={zips} dangling={index.dangling} variant="graph" />
    <details style={{ padding: "1.5rem", lineHeight: 1.8 }}>
      <summary>Read citation relationships as text</summary>
      <p>Each proposal below lists the numbered proposals it cites.</p>
      <ul>{index.zips.filter((zip) => zip.number !== null).map((zip) => (
        <li key={zip.id}><a href={`/zip/${zip.number}`}>ZIP {zip.number}: {zip.title}</a>: {zip.citations.length ? zip.citations.map((id, i) => <span key={id}>{i ? ", " : ""}<a href={`/zip/${id}`}>ZIP {id}</a></span>) : "no outgoing citations"}</li>
      ))}</ul>
    </details>
  </>;
}
