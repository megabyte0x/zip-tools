import Link from "next/link";
import { ForceGraph3D } from "../components/ForceGraph3D";
import { ZipExplorer } from "../components/ZipExplorer";
import { ZipOfTheDay } from "../components/ZipOfTheDay";
import { ZipRail } from "../components/ZipRail";
import { featuredZips } from "../lib/featured";
import { loadIndex } from "../lib/loadIndex";
import type { ZipRecord } from "../lib/types";
import { handleTrendingGet, type ViewsEnv } from "../lib/views";
import { zipOfTheDay, slimZipOfTheDay } from "../lib/zipOfTheDay";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

async function loadEnv(): Promise<ViewsEnv> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return (ctx.env ?? {}) as ViewsEnv;
  } catch {
    return {};
  }
}

function zipForViewId(zips: ZipRecord[], id: string): ZipRecord | undefined {
  return zips.find(
    (zip) => zip.id === id || zip.slug === id || (zip.number != null && String(zip.number) === id),
  );
}

async function mostViewedZips(zips: ZipRecord[], todayUtc: string): Promise<ZipRecord[]> {
  const res = await handleTrendingGet(await loadEnv(), todayUtc);
  const data = (await res.json()) as { items?: { id: string; count: number }[] };
  const items = data.items ?? [];
  return items
    .map((item) => zipForViewId(zips, item.id))
    .filter((zip): zip is ZipRecord => zip != null);
}

export default async function HomePage() {
  const index = loadIndex();
  const { zips, nus } = index;
  const featured = featuredZips(index);
  const utcDate = new Date().toISOString().slice(0, 10);
  const daily = zipOfTheDay(zips, utcDate);
  const numbered = zips
    .filter((zip) => zip.number != null)
    .map((zip) => ({ number: zip.number, slug: zip.slug }));
  const mostViewed = await mostViewedZips(zips, utcDate);
  const bodyFreeZips = zips.map((zip) => ({ ...zip, body: null }));

  return (
    <div>
      <section className={styles.intro} aria-labelledby="home-heading">
        <div>
          <h1 id="home-heading">Read and explore Zcash proposals</h1>
          <p>Browse the pinned ZIP corpus, follow citations, and read proposals in place.</p>
        </div>
        <Link className={styles.browseLink} href="#explorer">
          Browse ZIPs
        </Link>
      </section>
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
      {mostViewed.length > 0 ? <ZipRail title="Most viewed (7 days)" zips={mostViewed} /> : null}
      <ForceGraph3D
        zips={bodyFreeZips}
        dangling={index.dangling}
        variant="home"
      />
      <ZipOfTheDay zip={daily ? slimZipOfTheDay(daily) : null} numbered={numbered} />
      <section id="explorer" aria-label="ZIP explorer">
        <ZipExplorer zips={bodyFreeZips} />
      </section>
    </div>
  );
}
