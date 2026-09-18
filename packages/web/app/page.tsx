import Link from "next/link";
import { ZipExplorer } from "../components/ZipExplorer";
import { loadIndex } from "../lib/loadIndex";
import styles from "./page.module.css";

export default function HomePage() {
  const { zips, nus } = loadIndex();
  return (
    <div>
      <section className={styles.boards} aria-labelledby="nu-boards-heading">
        <h2 id="nu-boards-heading" className={styles.heading}>
          Network upgrades
        </h2>
        <ul className={styles.boardList}>
          {nus.map((nu) => (
            <li key={nu.id}>
              <Link className={styles.board} href={`/nu/${nu.id}`}>
                <span className={styles.boardId}>{nu.id}</span>
                <span className={styles.boardKind}>{nu.kind}</span>
                <span className={styles.boardCount}>
                  {nu.zips.length} ZIP{nu.zips.length === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <ZipExplorer zips={zips} />
    </div>
  );
}
