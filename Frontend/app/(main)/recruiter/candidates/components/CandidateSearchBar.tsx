import styles from "../candidates.module.css";

type CandidateSearchBarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
};

/** The main search box: name, headline, city, bio or a skill. */
export default function CandidateSearchBar({ searchQuery, onSearchChange }: CandidateSearchBarProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>Search</span>
      <input
        type="search"
        className={`${styles.input} ${styles.inputSearch}`}
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Name, job title, city or skill"
      />
    </label>
  );
}
