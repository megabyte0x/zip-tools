import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { sanitizeReaderHtml } from "../lib/prepareReader";
import { FALLBACK_CTA, readerMode } from "../lib/readerMode";
import { supportedIssueUrl } from "../lib/readerSource";
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

function MissingBody({
  discussionsTo,
  officialUrl,
}: {
  discussionsTo?: string | null;
  officialUrl: string;
}) {
  const issueUrl = supportedIssueUrl(discussionsTo);
  return (
    <p className={styles.fallback}>
      No proposal body is available in this snapshot.{" "}
      {issueUrl === null ? null : <a className={styles.cta} href={issueUrl}>Read the linked GitHub issue</a>}{" "}
      <a className={styles.cta} href={officialUrl}>
        {FALLBACK_CTA}
      </a>
    </p>
  );
}

function ReaderContent({ children }: { children: ReactNode }) {
  return (
    <div data-testid="reader-body">
      {children}
    </div>
  );
}

export function ReaderBody({
  body,
  bodyKind,
  officialUrl,
  discussionsTo,
  document: preparedDocument,
}: {
  body: string | null;
  bodyKind: ZipRecord["bodyKind"];
  officialUrl: string;
  bodySource?: ZipRecord["bodySource"];
  discussionsTo?: string | null;
  document?: PreparedReader;
}) {
  if (preparedDocument?.mode === "missing") {
    return (
      <ReaderContent>
        <MissingBody discussionsTo={discussionsTo} officialUrl={officialUrl} />
      </ReaderContent>
    );
  }

  if (preparedDocument) {
    return (
      <ReaderContent>
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
      </ReaderContent>
    );
  }

  const mode = readerMode(body, bodyKind);

  if (mode === "fallback") {
    return (
      <ReaderContent>
        <MissingBody discussionsTo={discussionsTo} officialUrl={officialUrl} />
      </ReaderContent>
    );
  }

  if (mode === "html") {
    const { html } = tocFromHtml(body ?? "");
    return (
      <ReaderContent>
        <div
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: sanitizeReaderHtml(html) }}
        />
      </ReaderContent>
    );
  }

  if (mode === "source") {
    return (
      <ReaderContent>
        <div className={styles.body}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={markdownHeadingComponents()}
          >
            {rstSourceToMarkdown(body ?? "")}
          </ReactMarkdown>
        </div>
      </ReaderContent>
    );
  }

  return (
    <ReaderContent>
      <div className={styles.body}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={markdownHeadingComponents()}
        >
          {body ?? ""}
        </ReactMarkdown>
      </div>
    </ReaderContent>
  );
}
