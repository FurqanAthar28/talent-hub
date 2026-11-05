import { Check, Eye } from "lucide-react";

import styles from "./marketing.module.css";

// Example content for the picture of the product (not real people).
const CHECKLIST = [
  { label: "Headline", done: true },
  { label: "Skills", done: true },
  { label: "Projects", done: true },
  { label: "CV", done: false },
];
const SKILLS = ["Django", "PostgreSQL", "Docker", "REST APIs"];

/**
 * A small picture of the product, built from the same pieces as the real
 * dashboard: a profile, its "ready for recruiters" bar, and a profile view.
 * It is decoration, so screen readers skip it (aria-hidden).
 */
export default function ProductPreview() {
  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.previewCard}>
        <div className={styles.previewPerson}>
          <span className={styles.previewAvatar}>AM</span>
          <span>
            <strong>Ayesha Malik</strong>
            <span className={styles.previewMuted}>Backend developer · Lahore</span>
          </span>
          <span className={styles.previewBadge}>Open to work</span>
        </div>

        <p className={styles.previewTitle}>Profile 75% ready for recruiters</p>
        <ul className={styles.previewChecklist}>
          {CHECKLIST.map((item) => (
            <li key={item.label} className={item.done ? styles.previewDone : ""}>
              <span>
                {item.done && <Check size={11} />}
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        <div className={styles.previewSkills}>
          {SKILLS.map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
        </div>
      </div>

      <div className={styles.previewToast}>
        <span className={styles.previewToastIcon}>
          <Eye size={16} />
        </span>
        <span>
          <strong>A recruiter at Systems Ltd</strong>
          <span className={styles.previewMuted}>viewed your profile · just now</span>
        </span>
      </div>
    </div>
  );
}
