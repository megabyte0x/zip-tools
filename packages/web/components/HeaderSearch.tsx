"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { searchSuggestions } from "../lib/searchSuggest";
import type { ZipRecord } from "../lib/types";
import styles from "./HeaderSearch.module.css";

export function HeaderSearch({ zips }: { zips: ZipRecord[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const hits = useMemo(() => searchSuggestions(zips, text), [zips, text]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const first = hits[0];
    if (first) {
      router.push(first.href);
      return;
    }
    router.push(`/zips?q=${encodeURIComponent(text.trim())}`);
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} role="search">
      <label className={styles.label}>
        <span className={styles.srOnly}>Search ZIPs</span>
        <input
          className={styles.input}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Number, title, or owner"
          autoComplete="off"
        />
      </label>
      {hits.length > 0 ? (
        <ul className={styles.suggestions} role="listbox">
          {hits.map((hit) => (
            <li key={hit.id} role="option">
              <Link className={styles.suggestion} href={hit.href}>
                {hit.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
