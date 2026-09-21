"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { filterZips } from "../lib/filter";
import type { ZipRecord } from "../lib/types";
import type { ExplorerQuery } from "../lib/workbenchContracts";
import { parseZipsQuery, serializeZipsQuery } from "../lib/zipsQuery";
import { SearchBand } from "./SearchBand";
import styles from "./ZipExplorer.module.css";
import { ZipTable } from "./ZipTable";

const EMPTY_QUERY: ExplorerQuery = {
  text: "",
  kind: "",
  status: "",
  nuId: "",
  category: "",
  sort: "number",
};

const EXPLORER_URL_KEYS = ["q", "kind", "status", "nu", "category", "sort"] as const;

function hasExplorerUrlKeys(search: string): boolean {
  const params = new URLSearchParams(search);
  return EXPLORER_URL_KEYS.some((key) => params.has(key));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function queryFromCompatibility(
  initialQuery: ExplorerQuery | undefined,
  initialText: string,
  initialKind: "draft" | "numbered" | "",
): ExplorerQuery {
  return initialQuery ?? { ...EMPTY_QUERY, text: initialText, kind: initialKind };
}

function writeBrowserQuery(query: ExplorerQuery, mode: "push" | "replace") {
  const current = `${window.location.search}${window.location.hash}`;
  const nextSearch = serializeZipsQuery(query, current);
  const nextUrl = `${window.location.pathname}${nextSearch}`;
  const currentUrl = `${window.location.pathname}${current}`;
  if (nextUrl === currentUrl) return;
  window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", nextUrl);
}

export function ZipExplorer({
  zips,
  initialQuery,
  initialText = "",
  initialKind = "",
}: {
  zips: ZipRecord[];
  initialQuery?: ExplorerQuery;
  initialText?: string;
  initialKind?: "draft" | "numbered" | "";
}) {
  const [query, setQuery] = useState<ExplorerQuery>(() =>
    queryFromCompatibility(initialQuery, initialText, initialKind),
  );
  const [browserReady, setBrowserReady] = useState(false);
  const latestQuery = useRef(query);
  latestQuery.current = query;

  useEffect(() => {
    const restoreFromUrl = () => setQuery(parseZipsQuery(window.location.search));
    if (hasExplorerUrlKeys(window.location.search)) restoreFromUrl();
    setBrowserReady(true);
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, []);

  useEffect(() => {
    if (!browserReady) return;
    const timeout = window.setTimeout(() => {
      writeBrowserQuery(latestQuery.current, "replace");
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [browserReady, query.text]);

  const statuses = useMemo(
    () => uniqueSorted(zips.flatMap((zip) => zip.status.map((entry) => entry.label))),
    [zips],
  );
  const nuIds = useMemo(() => uniqueSorted(zips.flatMap((zip) => zip.nuIds)), [zips]);
  const categories = useMemo(
    () => uniqueSorted(zips.map((zip) => zip.category ?? "")),
    [zips],
  );

  const filtered = useMemo(() => filterZips(zips, query), [zips, query]);

  const changeDiscrete = (patch: Partial<ExplorerQuery>) => {
    const next = { ...query, ...patch };
    setQuery(next);
    writeBrowserQuery(next, "push");
  };

  const clearFilters = () => {
    setQuery(EMPTY_QUERY);
    writeBrowserQuery(EMPTY_QUERY, "push");
  };

  const chips: Array<{ key: keyof ExplorerQuery; label: string }> = [
    ...(query.text ? [{ key: "text" as const, label: `Search: ${query.text}` }] : []),
    ...(query.kind
      ? [{ key: "kind" as const, label: query.kind === "draft" ? "Drafts" : "Numbered" }]
      : []),
    ...(query.status ? [{ key: "status" as const, label: `Status: ${query.status}` }] : []),
    ...(query.nuId ? [{ key: "nuId" as const, label: `NU: ${query.nuId}` }] : []),
    ...(query.category
      ? [{ key: "category" as const, label: `Category: ${query.category}` }]
      : []),
    ...(query.sort === "title" ? [{ key: "sort" as const, label: "Sort: title" }] : []),
  ];

  const removeChip = (key: keyof ExplorerQuery) => {
    changeDiscrete({ [key]: key === "sort" ? "number" : "" });
  };

  return (
    <section className={styles.explorer} aria-label="ZIP explorer">
      <SearchBand
        text={query.text}
        kind={query.kind}
        status={query.status}
        nuId={query.nuId}
        category={query.category}
        sort={query.sort}
        statuses={statuses}
        nuIds={nuIds}
        categories={categories}
        onTextChange={(text) => setQuery((current) => ({ ...current, text }))}
        onKindChange={(kind) => changeDiscrete({ kind })}
        onStatusChange={(status) => changeDiscrete({ status })}
        onNuIdChange={(nuId) => changeDiscrete({ nuId })}
        onCategoryChange={(category) => changeDiscrete({ category })}
        onSortChange={(sort) => changeDiscrete({ sort })}
      />

      <div className={styles.summaryRow}>
        <p className={styles.count} aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "result" : "results"}
        </p>
        {filtered.length > 0 && chips.length > 0 ? (
          <button className={styles.clear} type="button" onClick={clearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <ul className={styles.chips} aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button type="button" onClick={() => removeChip(chip.key)}>
                {chip.label} <span aria-hidden="true">×</span>
                <span className={styles.srOnly}>Remove {chip.label} filter</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <ZipTable zips={filtered} searchText={query.text} onClear={clearFilters} />
    </section>
  );
}
