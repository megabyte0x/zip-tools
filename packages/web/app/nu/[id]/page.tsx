import Link from "next/link";
import { notFound } from "next/navigation";
import { loadIndex } from "../../../lib/loadIndex";
import { nuRows } from "../../../lib/nuBoard";
import { StatusPills } from "../../../components/StatusPill";
import styles from "./page.module.css";

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

  return (
    <article className={styles.page}>
      <p className={styles.kind}>{nu.kind === "candidate" ? "Candidate upgrade" : "Live on Mainnet"}</p>
      <h1 className={styles.title}>{nu.title}</h1>
      <p className={styles.meta}>
        {rows.length} ZIP{rows.length === 1 ? "" : "s"}
      </p>
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
