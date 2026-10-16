import Link from "next/link";
import { partHref } from "../lib/agentDocuments";
import styles from "./ReaderParts.module.css";

export function ReaderParts({ href, count, selected }: { href: string; count: number; selected: number }) {
  if (count < 2) return null;
  return (
    <nav aria-label="Document parts" className={styles.parts}>
      <p className={styles.note}>
        Part {selected} of {count}. Read every part for the complete text.
      </p>
      <ul className={styles.list}>
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <Link
              className={styles.link}
              href={partHref(href, i + 1)}
              aria-current={selected === i + 1 ? "page" : undefined}
            >
              Part {i + 1}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
