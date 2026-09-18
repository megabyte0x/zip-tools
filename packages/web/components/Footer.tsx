import type { ZipIndexFile } from "../lib/types";
import styles from "./Footer.module.css";

export function Footer({ snapshot }: { snapshot: ZipIndexFile["snapshot"] }) {
  const label = `zcash/zips ${snapshot.sha.slice(0, 7)} ${snapshot.date}`;
  return (
    <footer className={styles.footer}>
      <a className={styles.link} href={snapshot.url}>
        {label}
      </a>
    </footer>
  );
}
