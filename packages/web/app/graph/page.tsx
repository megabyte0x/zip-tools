import { ForceGraph3D } from "../../components/ForceGraph3D";
import { loadIndex } from "../../lib/loadIndex";

export default function GraphPage() {
  const index = loadIndex();
  const zips = index.zips.map((zip) => ({ ...zip, body: null }));
  return <ForceGraph3D zips={zips} dangling={index.dangling} variant="graph" />;
}
