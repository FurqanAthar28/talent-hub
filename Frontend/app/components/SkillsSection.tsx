"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api/client";

type Skill = {
  id: number;
  name: string;
};

type SkillsSectionProps = {
  onProfileChange?: () => void;
  onUpdate: (skills: string[]) => void;
};

export default function SkillsSection({
  onProfileChange,
  onUpdate,
}: SkillsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [localSkills, setLocalSkills] = useState<Skill[]>([]);
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const loadSkills = useCallback(async () => {
    try {
      const res = await apiFetch("/profiles/skills");

      if (!res.ok) {
        return;
      }

      const data = await res.json();
      setLocalSkills(data);
      onUpdate(data.map((skill: Skill) => skill.name));
    } catch (err) {
      console.error("Failed to load skills:", err);
    }
  }, [onUpdate]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  function handleClose() {
    setIsOpen(false);
    setError("");
    setNewSkill("");
  }

  async function handleAdd() {
    const skill = newSkill.trim();

    if (!skill) {
      return;
    }

    const alreadyExists = localSkills.some(
      (item) => item.name.toLowerCase() === skill.toLowerCase(),
    );

    if (alreadyExists) {
      setError("This skill already exists.");
      return;
    }

    setError("");
    setIsAdding(true);

    try {
      const res = await apiFetch("/profiles/skills/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: skill }),
      });

      if (!res.ok) {
        setError("Failed to add skill. Please try again.");
        return;
      }

      const createdSkill = await res.json();
      const updated = [...localSkills, createdSkill];

      setLocalSkills(updated);
      onUpdate(updated.map((item) => item.name));
      onProfileChange?.();
      setNewSkill("");
    } catch (err) {
      console.error("Failed to add skill:", err);
      setError("Unable to connect to server.");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(skillId: number) {
    try {
      const res = await apiFetch(`/profiles/skills/${skillId}/delete`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setError("Failed to remove skill. Please try again.");
        return;
      }

      const updated = localSkills.filter((skill) => skill.id !== skillId);

      setLocalSkills(updated);
      onUpdate(updated.map((item) => item.name));
      onProfileChange?.();
    } catch (err) {
      console.error("Failed to delete skill:", err);
      setError("Unable to remove skill.");
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAdd();
    }
  }

  return (
    <>
      <section id="skills" className="card form-section">
        <div className="card-header flex-between">
          <div>
            <p className="eyebrow">Skills</p>
            <h3>Professional Skills</h3>
            <p className="muted text-sm">
              Add the technologies, tools, and strengths recruiters should find
              you for.
            </p>
          </div>

          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => setIsOpen(true)}
          >
            + Add Skill
          </button>
        </div>

        <div className="card-body">
          {localSkills.length === 0 ? (
            <div className="empty-state">
              <h3>No skills added yet</h3>
              <p>
                Add your first skill to make your profile easier to discover.
              </p>

              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsOpen(true)}
              >
                Add First Skill
              </button>
            </div>
          ) : (
            <div className="skill-tags">
              {localSkills.map((skill) => (
                <span key={skill.id} className="skill-tag">
                  {skill.name}

                  <button
                    type="button"
                    className="skill-remove"
                    onClick={() => handleDelete(skill.id)}
                    aria-label={`Remove ${skill.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {error && <p className="form-error mt-2">{error}</p>}
        </div>
      </section>

      {isOpen && (
        <div className="modal-overlay" onClick={handleClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Add Skill</p>
                <h3>Add a professional skill</h3>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={handleClose}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Skill name</label>
                <p className="form-help">
                  Add a skill recruiters may search for, such as Django, React,
                  PostgreSQL, or REST API.
                </p>

                <input
                  type="text"
                  value={newSkill}
                  onChange={(event) => setNewSkill(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Example: Django REST Framework"
                  autoFocus
                />

                <p className="text-xs muted mt-1">
                  Press Enter or click Add Skill.
                </p>
              </div>

              {error && <p className="form-error text-sm">{error}</p>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleAdd}
                  disabled={!newSkill.trim() || isAdding}
                >
                  {isAdding ? "Adding..." : "Add Skill"}
                </button>

                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleClose}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}