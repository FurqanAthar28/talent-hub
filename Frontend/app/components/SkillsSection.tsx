'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

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
  const [newSkill, setNewSkill] = useState('');
  const [localSkills, setLocalSkills] = useState<Skill[]>([]);
  const [error, setError] = useState('');

  const loadSkills = useCallback(async () => {
    try {
      const res = await apiFetch('/profiles/skills');
      if (res.ok) {
        const data = await res.json();
        setLocalSkills(data);
        onUpdate(data.map((skill: Skill) => skill.name));
      }
    } catch (err) {
      console.error('Failed to load skills:', err);
    }
  }, [onUpdate]);

useEffect(() => {
  async function loadInitialSkills() {
    await loadSkills();
  }

  loadInitialSkills();
}, [loadSkills]);

  function handleClose() {
    setIsOpen(false);
    setError('');
    setNewSkill('');
  }

  async function handleAdd() {
    const skill = newSkill.trim();
    if (!skill) return;

    const alreadyExists = localSkills.some(
      (item) => item.name.toLowerCase() === skill.toLowerCase()
    );

    if (alreadyExists) {
      setError('This skill already exists.');
      return;
    }

    setError('');

    try {
      const res = await apiFetch('/profiles/skills/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: skill }),
      });

      if (!res.ok) {
        setError('Failed to add skill. Please try again.');
        return;
      }

      const createdSkill = await res.json();
      const updated = [...localSkills, createdSkill];

      setLocalSkills(updated);
      onUpdate(updated.map((item) => item.name));
      onProfileChange?.();
      setNewSkill('');
    } catch (err) {
      console.error('Failed to add skill:', err);
      setError('Unable to connect to server.');
    }
  }

  async function handleDelete(skillId: number) {
    try {
      const res = await apiFetch(`/profiles/skills/${skillId}/delete`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        console.error('Failed to delete skill');
        return;
      }

      const updated = localSkills.filter((skill) => skill.id !== skillId);
      setLocalSkills(updated);
      onUpdate(updated.map((item) => item.name));
      onProfileChange?.();
    } catch (err) {
      console.error('Failed to delete skill:', err);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-header flex-between">
          <h3>Skills</h3>

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
            <p className="text-sm muted text-center">
              No skills added yet.{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => setIsOpen(true)}
              >
                Add your first skill
              </button>
            </p>
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
        </div>
      </div>

      {isOpen && (
        <div className="modal-overlay" onClick={handleClose}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Add Skills</h3>

              <button
                type="button"
                className="modal-close"
                onClick={handleClose}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Skill Name</label>
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. React, Python, Figma"
                  autoFocus
                />
                <p className="text-xs muted mt-1">Press Enter to add</p>
              </div>

              {error && <p className="form-error text-sm">{error}</p>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleAdd}
                  disabled={!newSkill.trim()}
                >
                  Add Skill
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