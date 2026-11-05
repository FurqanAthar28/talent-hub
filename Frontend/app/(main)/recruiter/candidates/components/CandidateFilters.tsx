import styles from "../candidates.module.css";

type CandidateFiltersProps = {
  skillFilter: string;
  locationFilter: string;
  onSkillChange: (value: string) => void;
  onLocationChange: (value: string) => void;
};

/** The two narrower filters next to the search box. */
export default function CandidateFilters({
  skillFilter,
  locationFilter,
  onSkillChange,
  onLocationChange,
}: CandidateFiltersProps) {
  return (
    <>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Skill</span>
        <input
          type="text"
          className={styles.input}
          placeholder="For example: React"
          value={skillFilter}
          onChange={(event) => onSkillChange(event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Location</span>
        <input
          type="text"
          className={styles.input}
          placeholder="City, or Remote"
          value={locationFilter}
          onChange={(event) => onLocationChange(event.target.value)}
        />
      </label>
    </>
  );
}
