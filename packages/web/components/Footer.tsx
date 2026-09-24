import { footerLabel } from "../lib/footer";
import type { ZipIndexFile } from "../lib/types";
import styles from "./Footer.module.css";

const REPOSITORY_URL = "https://github.com/megabyte0x/zip-tools";

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path
        fill="currentColor"
        d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.49c-2.23.49-2.7-1.08-2.7-1.08-.37-.93-.9-1.18-.9-1.18-.74-.5.06-.49.06-.49.82.06 1.25.84 1.25.84.73 1.25 1.91.89 2.38.68.07-.53.29-.9.52-1.1-1.78-.2-3.65-.89-3.65-3.96 0-.88.31-1.6.83-2.16-.08-.2-.36-1.02.08-2.12 0 0 .68-.22 2.2.82A7.7 7.7 0 0 1 8 4.8c.68 0 1.36.09 2 .27 1.52-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.52.56.83 1.28.83 2.16 0 3.08-1.87 3.76-3.66 3.96.29.25.54.73.54 1.48v2.2c0 .21.14.46.55.38A8 8 0 0 0 8 0Z"
      />
    </svg>
  );
}

export function Footer({ snapshot }: { snapshot: ZipIndexFile["snapshot"] }) {
  const label = footerLabel(snapshot);
  return (
    <footer className={styles.footer}>
      <p className={styles.sync}>
        <span className={styles.pulse} aria-hidden="true" />
        {snapshot.url ? (
          <a className={styles.link} href={snapshot.url}>
            {label}
          </a>
        ) : (
          label
        )}
      </p>
      <a
        className={styles.repositoryLink}
        href={REPOSITORY_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="GitHub repository"
      >
        <GitHubIcon />
      </a>
    </footer>
  );
}
