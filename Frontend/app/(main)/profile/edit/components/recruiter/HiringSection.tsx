"use client";

/**
 * "Hiring for": what candidates should know before reaching out.
 * Roles, skills and locations are chips you type; levels are on/off chips.
 * Skills suggest the same list as candidates' skills, so the words match.
 */

import { useEffect, useState } from "react";

import {
  HIRING_LEVELS,
  LIST_ITEM_MAX_LENGTH,
  MAX_HIRING_LOCATIONS,
  MAX_HIRING_ROLES,
  MAX_HIRING_SKILLS,
} from "@/app/config/constants";
import { getSkillOptions } from "@/app/services/skills";
import type { SectionProps, SetListField } from "../formTypes";
import styles from "./recruiter.module.css";
import TagInput, { ChoiceChips } from "./TagInput";

type Props = SectionProps & { setListField: SetListField };

export default function HiringSection({ formData, handleChange, setListField }: Props) {
  const [skillOptions, setSkillOptions] = useState<string[]>([]);

  useEffect(() => {
    let pageIsOpen = true;
    getSkillOptions()
      .then((options) => {
        if (pageIsOpen) setSkillOptions(options);
      })
      .catch(() => undefined); // suggestions are a nice extra; typing still works
    return () => {
      pageIsOpen = false;
    };
  }, []);

  return (
    <section id="hiring" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">Recruiter profile</p>
        <h2>Hiring for</h2>
        <p>Show candidates which roles you fill, so the right people reach out.</p>
      </div>

      <div className={styles.switchRow}>
        <span className={styles.switchText}>
          <strong>Hiring now</strong>
          <span>Shows a &quot;Hiring now&quot; badge on your profile. Turn it off between hiring rounds.</span>
        </span>
        <span className={styles.switch}>
          <input
            type="checkbox"
            name="hiringNow"
            checked={formData.hiringNow}
            onChange={handleChange}
            aria-label="Hiring now"
          />
          <span className={styles.switchTrack} aria-hidden="true" />
        </span>
      </div>

      <TagInput
        id="edit-hiringRoles"
        label="Roles you hire for"
        values={formData.hiringRoles}
        onChange={(values) => setListField("hiringRoles", values)}
        max={MAX_HIRING_ROLES}
        maxLength={LIST_ITEM_MAX_LENGTH}
        placeholder="e.g. Backend Engineer"
      />

      <ChoiceChips
        legend="Experience levels"
        options={HIRING_LEVELS}
        values={formData.hiringLevels}
        onChange={(values) => setListField("hiringLevels", values)}
      />

      <TagInput
        id="edit-hiringSkills"
        label="Skills you look for"
        values={formData.hiringSkills}
        onChange={(values) => setListField("hiringSkills", values)}
        max={MAX_HIRING_SKILLS}
        maxLength={LIST_ITEM_MAX_LENGTH}
        placeholder="e.g. Django"
        suggestions={skillOptions}
      />

      <TagInput
        id="edit-hiringLocations"
        label="Where they'd work"
        hint="Cities, or Remote."
        values={formData.hiringLocations}
        onChange={(values) => setListField("hiringLocations", values)}
        max={MAX_HIRING_LOCATIONS}
        maxLength={LIST_ITEM_MAX_LENGTH}
        placeholder="e.g. Lahore"
      />
    </section>
  );
}
