import Link from "next/link";
import type { ZipRecord } from "../lib/types";
import styles from "./ZipTable.module.css";

function zipHref(zip: ZipRecord): string {
  if (zip.number != null) return `/zip/${zip.id}`;
  return `/draft/${zip.slug}`;
}

function zipNumberLabel(zip: ZipRecord): string {
  return zip.number != null ? String(zip.number) : zip.slug;
}

export function ZipTable({ zips }: { zips: ZipRecord[] }) {
  if (zips.length === 0) {
    return (
      <p className={styles.empty}>
        No ZIPs match{" "}
        <a className={styles.official} href="https://zips.z.cash">
          zips.z.cash
        </a>
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
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
          {zips.map((zip) => (
            <tr key={zip.id}>
              <td>
                <Link className={styles.link} href={zipHref(zip)}>
                  {zipNumberLabel(zip)}
                </Link>
              </td>
              <td>{zip.title}</td>
              <td>{zip.statusRaw}</td>
              <td>{zip.category ?? ""}</td>
              <td>{zip.nuIds.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
