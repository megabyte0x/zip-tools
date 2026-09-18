import styles from "./SearchBand.module.css";

export type SearchBandProps = {
  text: string;
  status: string;
  nuId: string;
  category: string;
  statuses: string[];
  nuIds: string[];
  categories: string[];
  onTextChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onNuIdChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
};

export function SearchBand({
  text,
  status,
  nuId,
  category,
  statuses,
  nuIds,
  categories,
  onTextChange,
  onStatusChange,
  onNuIdChange,
  onCategoryChange,
}: SearchBandProps) {
  return (
    <form className={styles.band} onSubmit={(event) => event.preventDefault()}>
      <label className={styles.field}>
        <span className={styles.label}>Search</span>
        <input
          className={styles.input}
          type="search"
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Number, title, or owner"
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Status</span>
        <select
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
    </form>
  );
}
