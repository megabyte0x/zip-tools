import Link from "next/link";
import { notFound } from "next/navigation";
import { loadIndex } from "../../../lib/loadIndex";
import { nuRows } from "../../../lib/nuBoard";
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
      <h1>{nu.title}</h1>
      <p className={styles.meta}>
        <span>{nu.id}</span>
        <span>{nu.kind}</span>
      </p>
      {nu.notes ? <p className={styles.notes}>{nu.notes}</p> : null}
      <ul className={styles.rows}>
        {rows.map((row) => (
          <li key={row.number} className={styles.row}>
            {row.record ? (
              <Link className={styles.link} href={`/zip/${row.record.id}`}>
                ZIP {row.number} — {row.record.title}
                <span className={styles.status}>{row.record.statusRaw}</span>
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
