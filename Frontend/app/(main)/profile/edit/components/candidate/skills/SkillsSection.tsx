"use client";

/**
 * "Skills" card on the edit-profile page.
 * Skills have no "edit": you add one or remove it.
 */

import { useEffect, useState } from "react";

import { errorText } from "@/app/api/client";
import { MESSAGES } from "@/app/config/messages";
import {
  addProfileSkill,
  deleteProfileSkill,
  getProfileSkills,
  type Skill,
} from "@/app/services/skills";
import SkillChip from "./SkillChip";
import SkillSelector from "./SkillSelector";

type SkillsSectionProps = {
  content: Record<string, string | undefined>; // texts admins can edit
  // Called after a change, so the page can refresh "profile complete" etc.
  onProfileChange?: () => void | Promise<void>;
};

export default function SkillsSection({ content, onProfileChange }: SkillsSectionProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load my skills once.
  useEffect(() => {
    let pageIsOpen = true;

    getProfileSkills()
      .then((list) => {
        if (pageIsOpen) setSkills(list);
      })
      .catch((err: unknown) => {
        if (pageIsOpen) setError(errorText(err, MESSAGES.COMMON.LOAD_FAILED));
      });

    return () => {
      pageIsOpen = false;
    };
  }, []);

  async function handleAddSkill(skillName: string): Promise<boolean> {
    const name = skillName.trim();
    if (!name || saving) return false;

    const alreadyAdded = skills.some(
      (skill) => skill.name.toLowerCase() === name.toLowerCase()
    );
    if (alreadyAdded) {
      setError(content.skillAlreadyExists || MESSAGES.PROFILE.SKILL_ALREADY_ADDED);
      return false;
    }

    setSaving(true);
    setError("");

    try {
      const newSkill = await addProfileSkill(name);
      setSkills((previous) => [...previous, newSkill]);
      await onProfileChange?.();
      return true;
    } catch (err) {
      setError(errorText(err, MESSAGES.COMMON.SAVE_FAILED));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSkill(skillId: number) {
    if (saving) return;

    setSaving(true);
    setError("");

    try {
      await deleteProfileSkill(skillId);
      setSkills((previous) => previous.filter((skill) => skill.id !== skillId));
      await onProfileChange?.();
    } catch (err) {
      setError(errorText(err, MESSAGES.COMMON.DELETE_FAILED));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="skills" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">{content.skills || "Skills"}</p>
        <h2>{content.skillsTitle || "Professional skills"}</h2>
        <p>
          {content.skillsDescription ||
            "Add skills that help recruiters understand your strengths."}
        </p>
      </div>

      <SkillSelector skills={skills} onSelect={handleAddSkill} saving={saving} />

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      {skills.length > 0 && (
        <div className="skill-badges mt-2">
          {skills.map((skill) => (
            <SkillChip
              key={skill.id}
              skill={skill}
              busy={saving}
              onDelete={handleDeleteSkill}
            />
          ))}
        </div>
      )}
    </section>
  );
}
