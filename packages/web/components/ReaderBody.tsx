import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { FALLBACK_CTA, readerMode } from "../lib/readerMode";
import { allocateHeadingId, tocFromHtml } from "../lib/toc";
import type { ZipRecord } from "../lib/types";
import styles from "./ReaderBody.module.css";

export { FALLBACK_CTA, readerMode };

function textFromNode(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (typeof node === "object" && "props" in node) {
    return textFromNode((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

function markdownHeadingComponents() {
  const seen = new Map<string, number>();
  const heading = (Tag: "h2" | "h3") =>
    function Heading({ children, ...props }: { children?: ReactNode }) {
      const id = allocateHeadingId(textFromNode(children), seen);
      return (
        <Tag id={id} {...props}>
          {children}
        </Tag>
      );
    };
  return { h2: heading("h2"), h3: heading("h3") };
}

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
    const { html } = tocFromHtml(body ?? "");
    return (
      <div
        className={styles.body}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div className={styles.body}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={markdownHeadingComponents()}
      >
        {body ?? ""}
      </ReactMarkdown>
    </div>
  );
}
