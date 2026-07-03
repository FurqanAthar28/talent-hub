"use client";

import { useState } from "react";

import SkillChip from "./SkillChip";
import SkillSelector from "./SkillSelector";
import { emptySkillForm, type Skill, type SkillFormState } from "./skillTypes";
import { useSkills } from "./useSkills";

type SkillsSectionProps = {
  content?: Record<string, string | undefined>;
  onProfileChange?: () => void;
  onCountChange?: (count: number) => void;
};

export default function SkillsSection({
  content = {},
  onProfileChange,
  onCountChange,
}: SkillsSectionProps) {
  const { skills, error, saving, saveSkill, deleteSkill, clearError } =
    useSkills({
      onProfileChange,
      onCountChange,
    });

  const [isOpen, setIsOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [form, setForm] = useState<SkillFormState>(emptySkillForm);

  function handleOpen(skill?: Skill) {
    if (skill) {
      setEditingSkill(skill);
      setForm({ name: skill.name });
    } else {
      setEditingSkill(null);
      setForm(emptySkillForm);
    }

    clearError();
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
    setEditingSkill(null);
    setForm(emptySkillForm);
    clearError();
  }

  function handleSelectSkill(skillName: string) {
    setForm({ name: skillName });
  }

  async function handleSave() {
    const saved = await saveSkill(form, editingSkill?.id);

    if (saved) {
      handleClose();
    }
  }

  return (
    <>
      <section id="skills" className="card form-section">
        <div className="card-header flex-between">
          <div>
            <p className="eyebrow">Skills</p>
            <h3>{content.skillsTitle || "Skills"}</h3>
            <p className="muted text-sm">
              {content.skillsDescription ||
                "Select your technical and professional skills to strengthen your profile."}
            </p>
          </div>

          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => handleOpen()}
          >
            + Add Skill
          </button>
        </div>

        <div className="card-body">
          {skills.length === 0 ? (
            <div className="empty-state">
              <h3>No skills added yet</h3>
              <p>
                Add skills like Django, React, REST APIs, Python, or MySQL to
                help recruiters understand your strengths.
              </p>

              <button
                type="button"
                className="btn-primary"
                onClick={() => handleOpen()}
              >
                Add First Skill
              </button>
            </div>
          ) : (
            <div className="skills-list">
              {skills.map((skill) => (
                <SkillChip
                  key={skill.id}
                  skill={skill}
                  onEdit={handleOpen}
                  onDelete={deleteSkill}
                />
              ))}
            </div>
          )}

          {error && <p className="form-error mt-2">{error}</p>}
        </div>
      </section>

      {isOpen && (
        <SkillSelector
          selectedSkill={form.name}
          onSelect={handleSelectSkill}
          onClose={handleClose}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </>
  );
}