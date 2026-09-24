import Link from "next/link";
import type { MouseEvent } from "react";
import { shouldNavigateRow } from "../lib/rowNavigation";
import type { ZipRecord } from "../lib/types";
import { zipHref } from "../lib/zipHref";
import { StatusPills } from "./StatusPill";
import styles from "./ZipTable.module.css";

function zipIdentity(zip: ZipRecord): string {
  return zip.number != null ? `ZIP ${zip.number}` : "Draft";
}

function statusLabels(zip: ZipRecord): string[] {
  const labels = [...new Set(zip.status.map((entry) => entry.label))];
  return labels.length > 0 ? labels : [zip.statusRaw];
}

function StatusDetail({ zip }: { zip: ZipRecord }) {
  const labels = statusLabels(zip);
  const pills = <StatusPills labels={labels} />;
  if (zip.statusRaw.trim() === labels.join(", ").trim()) return pills;

  return (
    <div className={styles.statusCell}>
      {pills}
      <details className={styles.statusDetail}>
        <summary>Revision details</summary>
        <p>{zip.statusRaw}</p>
      </details>
    </div>
  );
}

const INTERACTIVE = "a, button, input, select, textarea, summary, details";

function rowClick(event: MouseEvent<HTMLTableRowElement>, href: string, go: (href: string) => void) {
  const target = event.target instanceof Element ? event.target : null;
  const navigate = shouldNavigateRow({
    targetInteractive: Boolean(target?.closest(INTERACTIVE)),
    modifier: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
    button: event.button,
    selection: window.getSelection()?.toString() ?? "",
  });
  if (navigate) go(href);
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
  onResultNavigate,
}: {
  zips: ZipRecord[];
  searchText?: string;
  onClear: () => void;
  onResultNavigate: (href: string) => void;
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
            <th id="zip-column-number">Number</th>
            <th id="zip-column-title">Title</th>
            <th id="zip-column-status">Status</th>
            <th id="zip-column-category">Category</th>
            <th id="zip-column-nu">NU</th>
          </tr>
        </thead>
        <tbody>
          {zips.map((zip) => {
            const owners = matchingOwners(zip, searchText);
            const href = zipHref(zip);
            return (
              <tr
                key={zip.id}
                className={styles.row}
                onClick={(event) => rowClick(event, href, onResultNavigate)}
              >
                <td data-label="Number" headers="zip-column-number">
                  <Link
                    className={styles.identityLink}
                    href={href}
                    onNavigate={(event) => {
                      event.preventDefault();
                      onResultNavigate(href);
                    }}
                  >
                    {zipIdentity(zip)}
                  </Link>
                </td>
                <td data-label="Title" headers="zip-column-title">
                  <Link
                    className={styles.titleLink}
                    href={href}
                    onNavigate={(event) => {
                      event.preventDefault();
                      onResultNavigate(href);
                    }}
                  >
                    {zip.title}
                  </Link>
                  {owners.map((owner) => (
                    <span className={styles.ownerMatch} key={owner}>
                      Matching owner: {owner}
                    </span>
                  ))}
                </td>
                <td data-label="Status" headers="zip-column-status">
                  <StatusDetail zip={zip} />
                </td>
                <td data-label="Category" headers="zip-column-category">
                  {zip.category ?? "—"}
                </td>
                <td data-label="NU" headers="zip-column-nu">
                  {zip.nuIds.join(", ") || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
