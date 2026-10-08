import Link from "next/link";
import { ForceGraph3D } from "../components/ForceGraph3D";
import { HeaderSearch } from "../components/HeaderSearch";
import { ZipOfTheDay } from "../components/ZipOfTheDay";
import { ZipRail } from "../components/ZipRail";
import { cloudflareEnv } from "../lib/cloudflareEnv";
import { browserZip } from "../lib/browserZip";
import { loadIndex } from "../lib/loadIndex";
import { newestZips } from "../lib/recent";
import type { NuEntry, ZipRecord } from "../lib/types";
import { handleTrendingGet, type ViewsEnv } from "../lib/views";
import { zipHref } from "../lib/zipHref";
import { zipOfTheDay, slimZipOfTheDay } from "../lib/zipOfTheDay";
import styles from "./page.module.css";
import { StatusPills } from "../components/StatusPill";

export const dynamic = "force-dynamic";

function zipForViewId(zips: ZipRecord[], id: string): ZipRecord | undefined {
  return zips.find(
    (zip) => zip.id === id || zip.slug === id || (zip.number != null && String(zip.number) === id),
  );
}

async function mostViewedZips(zips: ZipRecord[], todayUtc: string): Promise<ZipRecord[]> {
  const res = await handleTrendingGet(await cloudflareEnv<ViewsEnv>(), todayUtc);
  const data = (await res.json()) as { items?: { id: string; count: number }[] };
  const items = data.items ?? [];
  return items
    .map((item) => zipForViewId(zips, item.id))
    .filter((zip): zip is ZipRecord => zip != null);
}

const PREVIEW_COUNT = 3;

function UpgradeCard({ nu, byNumber }: { nu: NuEntry; byNumber: Map<number, ZipRecord> }) {
  const preview = nu.zips
    .map((number) => byNumber.get(number))
    .filter((zip): zip is ZipRecord => zip != null)
    .slice(0, PREVIEW_COUNT);
  const more = nu.zips.length - preview.length;
  return (
    <li className={styles.upgrade}>
      <Link className={styles.upgradeLink} href={`/nu/${nu.id}`}>
        <span className={styles.upgradeKind}>Candidate upgrade</span>
        <span className={styles.upgradeTitle}>{nu.title}</span>
        <span className={styles.upgradeCount}>
          {nu.zips.length} ZIP{nu.zips.length === 1 ? "" : "s"}
        </span>
      </Link>
      <ul className={styles.upgradeZips}>
        {preview.map((zip) => (
          <li key={zip.id}>
            <div className={styles.upgradeZipRow}>
              <Link className={styles.upgradeZipLink} href={zipHref(zip)}>
                <span className={styles.upgradeNumber}>{zip.number}</span>
                <span className={styles.upgradeZipTitle}>{zip.title}</span>
              </Link>
              <StatusPills labels={zip.status.map((entry) => entry.label)} />
            </div>
          </li>
        ))}
      </ul>
      {more > 0 ? (
        <Link className={styles.upgradeMore} href={`/nu/${nu.id}`}>
          +{more} more in {nu.title} <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </li>
  );
}

export default async function HomePage() {
  const index = loadIndex();
  const { zips, nus } = index;
  const byNumber = new Map<number, ZipRecord>();
  for (const zip of zips) if (zip.number != null) byNumber.set(zip.number, zip);
  const candidates = nus.filter((nu) => nu.kind === "candidate");
  const settled = nus.filter((nu) => nu.kind === "settled");
  const newest = newestZips(zips, 12);
  const utcDate = new Date().toISOString().slice(0, 10);
  const daily = zipOfTheDay(zips, utcDate);
  const numbered = zips
    .filter((zip) => zip.number != null)
    .map((zip) => ({ number: zip.number, slug: zip.slug }));
  const mostViewed = await mostViewedZips(zips, utcDate);
  const browserZips = zips.map(browserZip);

  return (
    <div className={styles.home}>
      <section className={styles.hero} aria-labelledby="home-heading">
        <p className={styles.eyebrow}>Zcash Improvement Proposals</p>
        <h1 id="home-heading" className={styles.title}>
          Read and explore Zcash proposals
        </h1>
        <p className={styles.lede}>Search ZIPs by number, title, or owner.</p>
        <div className={styles.heroSearch}>
          <HeaderSearch zips={browserZips} variant="hero" />
        </div>
      </section>

      {candidates.length > 0 ? (
        <section className={styles.upgrades} aria-labelledby="nu-boards-heading">
          <div className={styles.sectionHead}>
            <h2 id="nu-boards-heading" className={styles.heading}>
              Network upgrades
            </h2>
            {settled.length > 0 ? (
              <p className={styles.settled}>
                Live on Mainnet:{" "}
                {settled.map((nu, i) => (
                  <span key={nu.id}>
                    {i > 0 ? ", " : null}
                    <Link href={`/nu/${nu.id}`}>
                      {nu.title} · {nu.zips.length} ZIP{nu.zips.length === 1 ? "" : "s"}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
          </div>
          <ul className={styles.upgradeGrid}>
            {candidates.map((nu) => (
              <UpgradeCard key={nu.id} nu={nu} byNumber={byNumber} />
            ))}
          </ul>
        </section>
      ) : null}

      <ZipRail title="Newest proposals" zips={newest} showCreated />
      {mostViewed.length > 0 ? <ZipRail title="Most viewed (7 days)" zips={mostViewed} /> : null}
      <ZipOfTheDay zip={daily ? slimZipOfTheDay(daily) : null} numbered={numbered} />
      <ForceGraph3D zips={browserZips} dangling={index.dangling} variant="home" />
    </div>
  );
}
