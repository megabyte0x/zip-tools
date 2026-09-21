import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { FALLBACK_CTA, readerMode } from "../lib/readerMode";
import { rstSourceToMarkdown } from "../lib/rstSource";
import { allocateHeadingId, headingTextFromNode, tocFromHtml } from "../lib/toc";
import type { ZipRecord } from "../lib/types";
import type { PreparedReader } from "../lib/workbenchContracts";
import styles from "./ReaderBody.module.css";

export { FALLBACK_CTA, readerMode };

function markdownHeadingComponents() {
  const used = new Set<string>();
  const heading = (Tag: "h2" | "h3") =>
    function Heading({
      children,
      node: _node,
      ...props
    }: {
      children?: ReactNode;
      node?: unknown;
    }) {
      const id = allocateHeadingId(headingTextFromNode(children), used);
      return (
        <Tag {...props} id={id}>
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
  document: preparedDocument,
}: {
  body: string | null;
  bodyKind: ZipRecord["bodyKind"];
  officialUrl: string;
  document?: PreparedReader;
}) {
  if (preparedDocument?.mode === "missing") {
    return (
      <div data-testid="reader-body">
        <p className={styles.fallback}>
          <a className={styles.cta} href={officialUrl}>
            {FALLBACK_CTA}
          </a>
        </p>
      </div>
    );
  }

  if (preparedDocument) {
    return (
      <div data-testid="reader-body">
        {preparedDocument.mode === "degraded" ? (
          <aside className={styles.conversionNotice} role="status">
            <strong>Limited conversion.</strong>{" "}
            {preparedDocument.warnings.join(" ")}
          </aside>
        ) : null}
        <div
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: preparedDocument.html }}
        />
      </div>
    );
  }

  const mode = readerMode(body, bodyKind);

  if (mode === "fallback") {
    return (
      <div data-testid="reader-body">
        <p className={styles.fallback}>
          <a className={styles.cta} href={officialUrl}>
            {FALLBACK_CTA}
          </a>
        </p>
      </div>
    );
  }

  if (mode === "html") {
    const { html } = tocFromHtml(body ?? "");
    return (
      <div
        className={styles.body}
        data-testid="reader-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (mode === "source") {
    return (
      <div className={styles.body} data-testid="reader-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={markdownHeadingComponents()}
        >
          {rstSourceToMarkdown(body ?? "")}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className={styles.body} data-testid="reader-body">
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
