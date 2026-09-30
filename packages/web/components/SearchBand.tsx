import { useState } from "react";
import styles from "./SearchBand.module.css";

export type SearchBandProps = {
  text: string;
  kind: "" | "draft" | "numbered";
  status: string;
  nuId: string;
  category: string;
  sort: "number" | "title";
  statuses: string[];
  nuIds: string[];
  categories: string[];
  onTextChange: (value: string) => void;
  onKindChange: (value: "" | "draft" | "numbered") => void;
  onStatusChange: (value: string) => void;
  onNuIdChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSortChange: (value: "number" | "title") => void;
};

export function SearchBand({
  text,
  kind,
  status,
  nuId,
  category,
  sort,
  statuses,
  nuIds,
  categories,
  onTextChange,
  onKindChange,
  onStatusChange,
  onNuIdChange,
  onCategoryChange,
  onSortChange,
}: SearchBandProps) {
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  return (
    <form className={styles.band} onSubmit={(event) => event.preventDefault()}>
      <label className={`${styles.field} ${styles.search}`}>
        <span className={styles.label}>Search</span>
        <input
          aria-label="Search"
          className={styles.input}
          type="search"
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Number, title, or owner"
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Kind</span>
        <select
          aria-label="Kind"
          className={styles.select}
          value={kind}
          onChange={(event) =>
            onKindChange(event.target.value as "" | "draft" | "numbered")
          }
        >
          <option value="">All</option>
          <option value="numbered">Numbered</option>
          <option value="draft">Drafts</option>
        </select>
      </label>
      <button
        className={styles.moreFilters}
        type="button"
        aria-expanded={moreFiltersOpen}
        aria-controls="zip-explorer-secondary-filters"
        onClick={() => setMoreFiltersOpen((open) => !open)}
      >
        {moreFiltersOpen ? "Fewer filters" : "More filters"}
      </button>
      <div
        className={styles.secondary}
        id="zip-explorer-secondary-filters"
        data-open={moreFiltersOpen}
      >
        <label className={styles.field}>
          <span className={styles.label}>Status</span>
          <select
            aria-label="Status"
            className={styles.select}
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            <option value="">All</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>NU</span>
          <select
            aria-label="NU"
            className={styles.select}
            value={nuId}
            onChange={(event) => onNuIdChange(event.target.value)}
          >
            <option value="">All</option>
            {nuIds.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Category</span>
          <select
            aria-label="Category"
            className={styles.select}
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="">All</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Sort</span>
          <select
            aria-label="Sort"
            className={styles.select}
            value={sort}
            onChange={(event) => onSortChange(event.target.value as "number" | "title")}
          >
            <option value="number">Number</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>
    </form>
  );
}
