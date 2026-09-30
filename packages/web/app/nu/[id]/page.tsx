import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadIndex } from "../../../lib/loadIndex";
import { nuRows } from "../../../lib/nuBoard";
import { StatusPills } from "../../../components/StatusPill";
import { pageMetadata } from "../../../lib/pageMetadata";
import styles from "./page.module.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const nu = loadIndex().nus.find((entry) => entry.id === id);
  if (!nu) return { title: "Network upgrade not found" };
  return pageMetadata({
    title: `${nu.title} network upgrade`,
    description: `ZIPs in the ${nu.title} ${nu.kind} network upgrade (${nu.zips.length} ZIP${nu.zips.length === 1 ? "" : "s"}).`,
  });
}

export default async function NuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const index = loadIndex();
  const nu = index.nus.find((entry) => entry.id === id);
  const rows = nuRows(index, id);
  if (!nu || !rows) notFound();
  const deploymentZip = nu.deploymentZip === null
    ? null
    : index.zips.find((zip) => zip.number === nu.deploymentZip) ?? null;
  const stage = nu.kind === "candidate" ? "Candidate" : "Settled";

  return (
    <article className={styles.page}>
      <p className={styles.kind}>{nu.kind === "candidate" ? "Candidate upgrade" : "Live on Mainnet"}</p>
      <h1 className={styles.title}>{nu.title}</h1>
      <p className={styles.intro}>This page groups proposals for the {nu.title} network upgrade.</p>
      <dl className={styles.overview} aria-label={`${nu.title} overview`}>
        <div className={styles.overviewItem}>
          <dt>Stage</dt>
          <dd>{stage}</dd>
        </div>
        <div className={styles.overviewItem}>
          <dt>Proposals</dt>
          <dd>{rows.length} ZIP{rows.length === 1 ? "" : "s"}</dd>
        </div>
        {deploymentZip ? (
          <div className={styles.overviewItem}>
            <dt>Deployment ZIP</dt>
            <dd>
              <Link href={`/zip/${deploymentZip.id}`} aria-label={`Deployment ZIP ${deploymentZip.number}`}>
                ZIP {deploymentZip.number}
              </Link>
            </dd>
          </div>
        ) : null}
      </dl>
      {nu.notes ? <p className={styles.notes}>{nu.notes}</p> : null}
      <ul className={styles.rows}>
        {rows.map((row) => (
          <li key={row.number} className={styles.row}>
            {row.record ? (
              <Link className={styles.link} href={`/zip/${row.record.id}`}>
                <span className={styles.number}>ZIP {row.number}</span>
                <span className={styles.rowTitle}>{row.record.title}</span>
                <span className={styles.status}>
                  <StatusPills labels={row.record.status.map((entry) => entry.label)} />
                </span>
              </Link>
            ) : (
              <span className={styles.missing}>{`ZIP ${row.number} — not in snapshot`}</span>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}
