import Link from "next/link";
import { ForceGraph3D } from "../components/ForceGraph3D";
import { ZipExplorer } from "../components/ZipExplorer";
import { ZipOfTheDay } from "../components/ZipOfTheDay";
import { ZipRail } from "../components/ZipRail";
import { featuredZips } from "../lib/featured";
import { loadIndex } from "../lib/loadIndex";
import { zipOfTheDay } from "../lib/zipOfTheDay";
import styles from "./page.module.css";

export default function HomePage() {
  const index = loadIndex();
  const { zips, nus } = index;
  const featured = featuredZips(index);
  const utcDate = new Date().toISOString().slice(0, 10);
  const daily = zipOfTheDay(zips, utcDate);
  const numbered = zips
    .filter((zip) => zip.number != null)
    .map((zip) => ({ number: zip.number, slug: zip.slug }));

  return (
    <div>
      <ZipRail title="Featured" zips={featured} />
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
      <ForceGraph3D
        zips={zips.map((zip) => ({ ...zip, body: null }))}
        dangling={index.dangling}
        variant="home"
      />
      <ZipOfTheDay zip={daily} numbered={numbered} />
      <ZipExplorer zips={zips} />
    </div>
  );
}
