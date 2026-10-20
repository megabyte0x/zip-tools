import type { ReactNode } from "react";
import type { ZipRecord } from "../lib/types";
import { StatusPills } from "./StatusPill";
import styles from "./ZipMeta.module.css";

function MetadataValue({ value }: { value: string }) {
  const source = value.trim();
  const person = /^(.*?)\s*<([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>$/.exec(source);
  if (person) {
    return <a className={styles.link} href={`mailto:${person[2]}`}>{person[1].trim() || person[2]}</a>;
  }

  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of source.matchAll(/<(https?:\/\/[^>\s]+)>|(https?:\/\/[^\s<>]+)/g)) {
    if (match.index > last) nodes.push(source.slice(last, match.index));
    const href = match[1] ?? match[2];
    nodes.push(<a className={styles.link} key={match.index} href={href}>{href}</a>);
    last = match.index + match[0].length;
  }
  nodes.push(source.slice(last));
  return <>{nodes}</>;
}

export function ZipMeta({ zip }: { zip: ZipRecord }) {
  const idLabel = zip.number != null ? String(zip.number) : zip.slug;
  const links = [
    { href: zip.officialUrl, label: "Official" },
    { href: zip.githubUrl, label: "GitHub" },
    ...(zip.discussionsTo ? [{ href: zip.discussionsTo, label: "Discussions" }] : []),
  ].filter((link) => link.href);

  return (
    <dl className={styles.meta}>
      <div className={styles.item}>
        <dt className={styles.term}>ID</dt>
        <dd className={styles.value}>{idLabel}</dd>
      </div>
      <div className={styles.item}>
        <dt className={styles.term}>Status</dt>
        <dd className={styles.value}>
          <StatusPills labels={zip.status.map((entry) => entry.label)} />
        </dd>
      </div>
      <div className={styles.item}>
        <dt className={styles.term}>Category</dt>
        <dd className={styles.value}>{zip.category ?? ""}</dd>
      </div>
      <div className={styles.item}>
        <dt className={styles.term}>Owners</dt>
        <dd className={styles.value}>
          <ul className={styles.owners}>
            {zip.owners.map((owner) => (
              <li key={owner.name}>
                <MetadataValue value={owner.email ? `${owner.name} <${owner.email}>` : owner.name} />
              </li>
            ))}
          </ul>
        </dd>
      </div>
      <div className={styles.item}>
        <dt className={styles.term}>Created</dt>
        <dd className={styles.value}>{zip.created ?? ""}</dd>
      </div>
      <div className={styles.item}>
        <dt className={styles.term}>License</dt>
        <dd className={styles.value}><MetadataValue value={zip.license ?? ""} /></dd>
      </div>
      <div className={styles.item}>
        <dt className={styles.term}>Links</dt>
        <dd className={styles.value}>
          <ul className={styles.links}>
            {links.map((link) => (
              <li key={link.label}>
                <a className={styles.link} href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </dd>
      </div>
      {zip.extraMetadata?.map((field) => (
        <div className={styles.item} key={field.name}>
          <dt className={styles.term}>{field.name.replaceAll("-", " ")}</dt>
          <dd className={styles.value}>
            <ul className={styles.owners}>
              {field.values.map((value, index) => (
                <li key={index}><MetadataValue value={value} /></li>
              ))}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  );
}
