"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { searchSuggestions } from "../lib/searchSuggest";
import type { ZipRecord } from "../lib/types";
import { Input } from "./ui/input";
import styles from "./HeaderSearch.module.css";

export function HeaderSearch({ zips }: { zips: ZipRecord[] }) {
  const router = useRouter();
  const listboxId = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const hits = useMemo(() => searchSuggestions(zips, text), [zips, text]);
  const expanded = open && hits.length > 0;
  const active = expanded && activeIndex >= 0 ? hits[activeIndex] : undefined;

  function navigate(href: string) {
    setOpen(false);
    setActiveIndex(-1);
    router.push(href);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = active ?? hits[0];
    if (selected) {
      navigate(selected.href);
      return;
    }
    navigate(`/zips?q=${encodeURIComponent(text.trim())}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "ArrowDown" && hits.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index + 1) % hits.length);
      return;
    }
    if (event.key === "ArrowUp" && hits.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index <= 0 ? hits.length - 1 : index - 1));
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} role="search">
      <label className={styles.label}>
        <span className={styles.srOnly}>Search ZIPs</span>
        <Input
          className={styles.input}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={expanded}
          aria-activedescendant={active ? `${listboxId}-${active.id}` : undefined}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Number, title, or owner"
          autoComplete="off"
        />
      </label>
      {expanded ? (
        <ul id={listboxId} className={styles.suggestions} role="listbox">
          {hits.map((hit, index) => (
            <li
              id={`${listboxId}-${hit.id}`}
              key={hit.id}
              className={index === activeIndex ? styles.highlighted : undefined}
              role="option"
              aria-selected={index === activeIndex}
            >
              <Link
                className={styles.suggestion}
                href={hit.href}
                onClick={() => {
                  setOpen(false);
                  setActiveIndex(-1);
                }}
              >
                {hit.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <p className={styles.srOnly} role="status" aria-live="polite">
        {text.trim() && open
          ? hits.length > 0
            ? `${hits.length} suggestion${hits.length === 1 ? "" : "s"} available.`
            : "No matches. Press Enter to browse all ZIPs."
          : ""}
      </p>
    </form>
  );
}
