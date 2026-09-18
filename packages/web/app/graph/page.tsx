import { GlobalCitationGraph } from "../../components/CitationGraph";
import { loadIndex } from "../../lib/loadIndex";
import styles from "./page.module.css";

export default function GraphPage() {
  const index = loadIndex();
  const slim = {
    ...index,
    zips: index.zips.map((zip) => ({ ...zip, body: null })),
  };
  return (
    <div>
      <h1 className={styles.heading}>Citation graph</h1>
      <GlobalCitationGraph index={slim} />
    </div>
  );
}
