import { ZipExplorer } from "../components/ZipExplorer";
import { loadIndex } from "../lib/loadIndex";

export default function HomePage() {
  const { zips } = loadIndex();
  return <ZipExplorer zips={zips} />;
}
