import Link from "next/link";
import styles from "./not-found.module.css";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby="not-found-title">
        <p className={styles.eyebrow}>404</p>
        <h1 id="not-found-title" className={styles.title}>Page not found</h1>
        <p className={styles.description}>This page does not exist. Browse the ZIP index or visit the official ZIP site.</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/zips">Browse ZIPs</Link>
          <a className={styles.secondary} href="https://zips.z.cash">Official ZIP site</a>
        </div>
      </section>
    </div>
  );
}
