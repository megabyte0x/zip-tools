"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { searchSuggestions } from "../lib/searchSuggest";
import type { ZipRecord } from "../lib/types";
import { Input } from "./ui/input";
import styles from "./HeaderSearch.module.css";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export function HeaderSearch({
  zips,
  variant = "header",
}: {
  zips: ZipRecord[];
  variant?: "header" | "hero";
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const listboxId = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const hits = useMemo(() => searchSuggestions(zips, text), [zips, text]);
  const expanded = open && hits.length > 0;
  const active = expanded && activeIndex >= 0 ? hits[activeIndex] : undefined;

  useEffect(() => {
    const focusOnSlash = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      formRef.current?.querySelector("input")?.focus();
    };
    window.addEventListener("keydown", focusOnSlash);
    return () => window.removeEventListener("keydown", focusOnSlash);
  }, []);

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
    <form
      ref={formRef}
      className={variant === "hero" ? `${styles.form} ${styles.hero}` : styles.form}
      onSubmit={onSubmit}
      role="search"
    >
      <label className={styles.label}>
        <span className={styles.srOnly}>Search ZIPs</span>
        <Search className={styles.icon} aria-hidden="true" />
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
          onBlur={() => {
            setOpen(false);
            setActiveIndex(-1);
          }}
          onKeyDown={onKeyDown}
          placeholder={variant === "hero" ? "Search 317, Orchard, or an owner" : "Number, title, or owner"}
          autoComplete="off"
        />
        <kbd className={styles.kbd} aria-hidden="true">/</kbd>
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
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => navigate(hit.href)}
            >
              <span className={styles.suggestion}>{hit.label}</span>
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
