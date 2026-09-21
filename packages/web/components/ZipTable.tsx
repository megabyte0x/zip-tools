import Link from "next/link";
import type { ZipRecord } from "../lib/types";
import { zipHref } from "../lib/zipHref";
import styles from "./ZipTable.module.css";

function zipIdentity(zip: ZipRecord): string {
  return zip.number != null ? `ZIP ${zip.number}` : "Draft";
}

function statusLabels(zip: ZipRecord): string {
  return [...new Set(zip.status.map((entry) => entry.label))].join(", ") || zip.statusRaw;
}

function StatusDetail({ zip }: { zip: ZipRecord }) {
  const labels = statusLabels(zip);
  if (zip.statusRaw.trim() === labels.trim()) return <span>{labels}</span>;

  return (
    <details className={styles.statusDetail}>
      <summary>{labels} (revision details)</summary>
      <p>{zip.statusRaw}</p>
    </details>
  );
}

function matchingOwners(zip: ZipRecord, searchText: string): string[] {
  const needle = searchText.trim().toLocaleLowerCase();
  if (!needle) return [];
  return zip.owners
    .map((owner) => owner.name)
    .filter((name) => name.toLocaleLowerCase().includes(needle));
}

export function ZipTable({
  zips,
  searchText = "",
  onClear,
}: {
  zips: ZipRecord[];
  searchText?: string;
  onClear: () => void;
}) {
  if (zips.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No ZIPs match your filters.</p>
        <button className={styles.clear} type="button" onClick={onClear}>
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <colgroup>
          <col className={styles.identityColumn} />
          <col className={styles.titleColumn} />
          <col className={styles.statusColumn} />
          <col className={styles.categoryColumn} />
          <col className={styles.nuColumn} />
        </colgroup>
        <thead>
          <tr>
            <th>Number</th>
            <th>Title</th>
            <th>Status</th>
            <th>Category</th>
            <th>NU</th>
          </tr>
        </thead>
        <tbody>
          {zips.map((zip) => {
            const owners = matchingOwners(zip, searchText);
            return (
              <tr key={zip.id}>
                <td data-label="Number">
                  <Link className={styles.identityLink} href={zipHref(zip)}>
                    {zipIdentity(zip)}
                  </Link>
                </td>
                <td data-label="Title">
                  <Link className={styles.titleLink} href={zipHref(zip)}>
                    {zip.title}
                  </Link>
                  {owners.map((owner) => (
                    <span className={styles.ownerMatch} key={owner}>
                      Matching owner: {owner}
                    </span>
                  ))}
                </td>
                <td data-label="Status">
                  <StatusDetail zip={zip} />
                </td>
                <td data-label="Category">{zip.category ?? "—"}</td>
                <td data-label="NU">{zip.nuIds.join(", ") || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
