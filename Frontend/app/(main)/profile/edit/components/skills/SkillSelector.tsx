"use client";

import { useMemo, useState } from "react";
import { SKILL_OPTIONS } from "./skillOptions";

type SkillSelectorProps = {
  selectedSkill: string;
  onSelect: (skill: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
};

export default function SkillSelector({
  selectedSkill,
  onSelect,
  onClose,
  onSave,
  saving,
}: SkillSelectorProps) {
  const [search, setSearch] = useState("");

  const filteredSkills = useMemo(() => {
    return SKILL_OPTIONS.filter((skill) =>
      skill.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Skills</p>
            <h3>Select a Skill</h3>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Search Skill</label>

            <input
              type="text"
              value={search}
              placeholder="Search skills..."
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="skills-selector-list">
            {filteredSkills.map((skill) => (
              <button
                key={skill}
                type="button"
                className={
                  selectedSkill === skill
                    ? "skill-option active"
                    : "skill-option"
                }
                onClick={() => onSelect(skill)}
              >
                {skill}
              </button>
            ))}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={!selectedSkill || saving}
              onClick={onSave}
            >
              {saving ? "Saving..." : "Add Skill"}
            </button>

            <button
              type="button"
              className="btn-outline"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}