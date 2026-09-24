import { ForceGraph3D } from "../../components/ForceGraph3D";
import { loadIndex } from "../../lib/loadIndex";
import { pageMetadata } from "../../lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Citation graph",
  description: "Interactive 3D map of which Zcash Improvement Proposals cite each other.",
});

export default function GraphPage() {
  const index = loadIndex();
  const zips = index.zips.map((zip) => ({ ...zip, body: null }));
  return <ForceGraph3D zips={zips} dangling={index.dangling} variant="graph" />;
}
