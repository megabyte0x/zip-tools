"use client";

import { useMemo, useState } from "react";
import { filterZips } from "../lib/filter";
import type { ZipRecord } from "../lib/types";
import { SearchBand } from "./SearchBand";
import { ZipTable } from "./ZipTable";

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function ZipExplorer({ zips }: { zips: ZipRecord[] }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [nuId, setNuId] = useState("");
  const [category, setCategory] = useState("");

  const statuses = useMemo(
    () => uniqueSorted(zips.map((zip) => zip.statusRaw)),
    [zips],
  );
  const nuIds = useMemo(
    () => uniqueSorted(zips.flatMap((zip) => zip.nuIds)),
    [zips],
  );
  const categories = useMemo(
    () => uniqueSorted(zips.map((zip) => zip.category ?? "")),
    [zips],
  );

  const filtered = useMemo(
    () =>
      filterZips(zips, {
        text,
        status: status || undefined,
        nuId: nuId || undefined,
        category: category || undefined,
      }),
    [zips, text, status, nuId, category],
  );

  return (
    <div>
      <SearchBand
        text={text}
        status={status}
        nuId={nuId}
        category={category}
        statuses={statuses}
        nuIds={nuIds}
        categories={categories}
        onTextChange={setText}
        onStatusChange={setStatus}
        onNuIdChange={setNuId}
        onCategoryChange={setCategory}
      />
      <ZipTable zips={filtered} />
    </div>
  );
}
