import Link from "next/link";
import { partHref } from "../lib/agentDocuments";

export function ReaderParts({ href, count, selected }: { href: string; count: number; selected: number }) {
  if (count < 2) return null;
  return (
    <nav aria-label="Document parts" style={{ margin: "1rem 0", lineHeight: 2 }}>
      <p>This proposal has {count} parts. Reading part {selected}; follow all parts for the complete text.</p>
      {Array.from({ length: count }, (_, i) => (
        <Link key={i} href={partHref(href, i + 1)} aria-current={selected === i + 1 ? "page" : undefined} style={{ marginRight: "1rem" }}>
          Part {i + 1}
        </Link>
      ))}
    </nav>
  );
}
