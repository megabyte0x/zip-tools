import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { FALLBACK_CTA, readerMode } from "../lib/readerMode";
import type { ZipRecord } from "../lib/types";
import styles from "./ReaderBody.module.css";

export { FALLBACK_CTA, readerMode };

export function ReaderBody({
  body,
  bodyKind,
  officialUrl,
}: {
  body: string | null;
  bodyKind: ZipRecord["bodyKind"];
  officialUrl: string;
}) {
  const mode = readerMode(body, bodyKind);

  if (mode === "fallback") {
    return (
      <p className={styles.fallback}>
        <a className={styles.cta} href={officialUrl}>
          {FALLBACK_CTA}
        </a>
      </p>
    );
  }

  if (mode === "html") {
    return (
      <div
        className={styles.body}
        dangerouslySetInnerHTML={{ __html: body ?? "" }}
      />
    );
  }

  return (
    <div className={styles.body}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {body ?? ""}
      </ReactMarkdown>
    </div>
  );
}
