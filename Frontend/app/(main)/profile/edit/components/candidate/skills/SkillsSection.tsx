"use client";

import { useEffect, useState } from "react";
import {
  addProfileSkill,
  deleteProfileSkill,
  getProfileSkills,
  type Skill,
} from "@/app/services/skills"; 

import SkillChip from "./SkillChip";
import SkillSelector from "./SkillSelector";

type SkillsSectionProps = {
  content: Record<string, string | undefined>;
  onProfileChange?: () => void | Promise<void>;
};

export default function SkillsSection({
  content,
  onProfileChange,
}: SkillsSectionProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadSkills() {
    try {
      const data = await getProfileSkills();
      setSkills(data);
    } catch {
      setSkills([]);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSkills();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  async function handleAddSkill(skillName: string) {
    const cleanSkillName = skillName.trim();

    if (!cleanSkillName) return;

    const alreadyExists = skills.some(
      (skill) =>
        skill.name.toLowerCase() === cleanSkillName.toLowerCase(),
    );

    if (alreadyExists) {
      setError(content.skillAlreadyExists || "This skill is already added.");
      return;
    }

    setSaving(true);
    setError("");

    try {
     const newSkill = await addProfileSkill(cleanSkillName);
      setSkills((prev) => [...prev, newSkill]);
      await onProfileChange?.();
    } catch {
      setError(content.genericError || "Unable to add skill.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSkill(skillId: number) {
    setError("");

    try {
      await deleteProfileSkill(skillId);
      setSkills((prev) => prev.filter((skill) => skill.id !== skillId));
      await onProfileChange?.();
    } catch {
      setError(content.genericError || "Unable to remove skill.");
    }
  }

  return (
    <section id="skills" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">{content.skills || "Skills"}</p>
        <h2>{content.skillsTitle || "Professional Skills"}</h2>
        <p>
          {content.skillsDescription ||
            "Add skills that help recruiters understand your strengths."}
        </p>
      </div>

      <SkillSelector
        skills={skills}
        onSelect={handleAddSkill}
        saving={saving}
      />

      {error && <div className="form-error">{error}</div>}

      {skills.length > 0 && (
        <div className="skill-badges mt-2">
          {skills.map((skill) => (
            <SkillChip
  key={skill.id}
  skill={skill}
  onEdit={() => {}}
  onDelete={handleDeleteSkill}
/>
          ))}
        </div>
      )}
    </section>
  );
}
