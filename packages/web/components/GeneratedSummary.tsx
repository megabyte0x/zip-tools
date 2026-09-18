"use client";

import { useCallback, useEffect, useState } from "react";
import { FALLBACK_CTA, readerMode } from "../lib/readerMode";
import type { ZipRecord } from "../lib/types";
import styles from "./GeneratedSummary.module.css";

export function GeneratedSummary({
  id,
  body,
  bodyKind,
  officialUrl,
}: {
  id: string;
  body: string | null;
  bodyKind: ZipRecord["bodyKind"];
  officialUrl: string;
}) {
  const mode = readerMode(body, bodyKind);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<"unavailable" | "needs-body" | null>(
    body == null ? "needs-body" : null,
  );
  const [retry, setRetry] = useState(0);

  const load = useCallback(async () => {
    if (body == null) {
      setError("needs-body");
      setText(null);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/summary/${encodeURIComponent(id)}`);
      if (res.status === 422) {
        setError("needs-body");
        setText(null);
        return;
      }
      if (!res.ok) {
        setError("unavailable");
        setText(null);
        return;
      }
      const data = (await res.json()) as { text?: unknown };
      if (typeof data.text !== "string") {
        setError("unavailable");
        setText(null);
        return;
      }
      setText(data.text);
    } catch {
      setError("unavailable");
      setText(null);
    }
  }, [id, body]);

  useEffect(() => {
    void load();
  }, [load, retry]);

  return (
    <details className={styles.accordion}>
      <summary className={styles.title}>Generated summary</summary>
      {error === "needs-body" ? (
        <div className={styles.panel}>
          <p className={styles.copy}>A summary needs an in-app body.</p>
          {mode === "fallback" ? (
            <a className={styles.cta} href={officialUrl}>
              {FALLBACK_CTA}
            </a>
          ) : null}
        </div>
      ) : error === "unavailable" ? (
        <div className={styles.panel}>
          <p className={styles.copy}>Summary is unavailable.</p>
          <button type="button" className={styles.retry} onClick={() => setRetry((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : text ? (
        <p className={styles.text}>{text}</p>
      ) : null}
    </details>
  );
}
