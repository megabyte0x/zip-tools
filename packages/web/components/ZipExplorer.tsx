"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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

type ResultNavigation = {
  sourceUrl: string;
  phase: "pending" | "restoring";
};

type NavigationWithEvents = EventTarget & {
  addEventListener(type: "navigate", listener: (event: Event) => void): void;
  removeEventListener(type: "navigate", listener: (event: Event) => void): void;
};

type NavigateEvent = Event & {
  navigationType?: string;
  destination?: { url: string };
};

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
  const router = useRouter();
  const [query, setQuery] = useState<ExplorerQuery>(() =>
    queryFromCompatibility(initialQuery, initialText, initialKind),
  );
  const [browserReady, setBrowserReady] = useState(false);
  const [navigationPhase, setNavigationPhase] = useState<"idle" | "pending" | "restoring">(
    "idle",
  );
  const [, startNavigation] = useTransition();
  const latestQuery = useRef(query);
  const resultNavigation = useRef<ResultNavigation | null>(null);
  latestQuery.current = query;

  useEffect(() => {
    // Any client-side navigation (ours or a same-route <Link> click elsewhere, e.g. the
    // header's Browse/Drafts links) fires a Navigation API "navigate" event with the real
    // destination URL. Back/forward ("traverse") is handled by restoreFromUrl below via the
    // popstate listener; useSearchParams() is deliberately avoided here because Next's router
    // doesn't know about the raw history.pushState/replaceState entries writeBrowserQuery
    // creates, so it can report a stale search string right after a real popstate restore.
    const handleNavigate = (event: NavigateEvent) => {
      const transaction = resultNavigation.current;
      if (event.navigationType === "traverse") {
        if (!transaction || !event.cancelable) return;
        event.preventDefault();
        resultNavigation.current = null;
        setNavigationPhase("idle");
        startNavigation(() => router.replace(transaction.sourceUrl, { scroll: false }));
        return;
      }
      if (transaction) return;
      const destination = event.destination?.url;
      if (!destination) return;
      let url: URL;
      try {
        url = new URL(destination);
      } catch {
        return;
      }
      if (url.pathname !== window.location.pathname) return;
      const parsed = parseZipsQuery(url.search);
      if (serializeZipsQuery(parsed, "") === serializeZipsQuery(latestQuery.current, "")) return;
      setQuery(parsed);
    };
    const restoreFromUrl = () => {
      const transaction = resultNavigation.current;
      if (transaction) {
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (currentUrl === transaction.sourceUrl) {
          resultNavigation.current = null;
          setNavigationPhase("idle");
          return;
        }

        transaction.phase = "restoring";
        setNavigationPhase("restoring");
        window.history.forward();
        return;
      }

      setQuery(parseZipsQuery(window.location.search));
    };
    if (hasExplorerUrlKeys(window.location.search)) restoreFromUrl();
    setBrowserReady(true);
    const navigation = (window as Window & { navigation?: NavigationWithEvents }).navigation;
    navigation?.addEventListener("navigate", handleNavigate);
    window.addEventListener("popstate", restoreFromUrl);
    return () => {
      navigation?.removeEventListener("navigate", handleNavigate);
      window.removeEventListener("popstate", restoreFromUrl);
      resultNavigation.current = null;
    };
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

  const navigateToResult = (href: string) => {
    if (resultNavigation.current) return;

    resultNavigation.current = {
      sourceUrl: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      phase: "pending",
    };
    setNavigationPhase("pending");
    startNavigation(() => router.push(href));
  };

  return (
    <section
      className={styles.explorer}
      aria-label="ZIP explorer"
      aria-busy={navigationPhase !== "idle"}
    >
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

      <ZipTable
        zips={filtered}
        searchText={query.text}
        onClear={clearFilters}
        onResultNavigate={navigateToResult}
      />
    </section>
  );
}
