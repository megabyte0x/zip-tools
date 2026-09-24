import type { CSSProperties } from "react";
import { statusColor } from "../lib/statusColor";
import styles from "./StatusPill.module.css";

/** A status label with its graph colour, so a status looks the same on every page. */
export function StatusPill({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={className ? `${styles.pill} ${className}` : styles.pill}
      style={{ "--status": statusColor(label) } as CSSProperties}
    >
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  );
}

export function StatusPills({ labels }: { labels: string[] }) {
  const unique = [...new Set(labels.filter(Boolean))];
  return (
    <span className={styles.group}>
      {unique.map((label) => (
        <StatusPill key={label} label={label} />
      ))}
    </span>
  );
}
