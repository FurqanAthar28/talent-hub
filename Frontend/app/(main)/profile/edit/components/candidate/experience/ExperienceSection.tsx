"use client";

/**
 * "Work experience" card on the edit-profile page: a list of my jobs,
 * plus a pop-up to add or edit one.
 * Loading and saving are done by useProfileList (shared with Projects).
 */

import { useState, type ChangeEvent } from "react";

import { MESSAGES } from "@/app/config/messages";
import { useProfileList } from "../useProfileList";
import ExperienceCard from "./ExperienceCard";
import ExperienceModal from "./ExperienceModal";
import {
  emptyExperienceForm,
  EXPERIENCE_ROUTES,
  experienceToForm,
  formToExperienceBody,
  type Experience,
  type ExperienceFormState,
} from "./experienceTypes";

type ExperienceSectionProps = {
  // Called after a change, so the page can refresh "profile complete" etc.
  onProfileChange?: () => void;
};

export default function ExperienceSection({ onProfileChange }: ExperienceSectionProps) {
  const experiences = useProfileList<Experience>(EXPERIENCE_ROUTES, onProfileChange);

  const [isOpen, setIsOpen] = useState(false);
  // null = adding a new job; a number = editing that job.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ExperienceFormState>(emptyExperienceForm);

  // One handler for every box. A checkbox gives "checked" (true/false),
  // the other boxes give "value" (text).
  function handleFormChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const box = event.target as HTMLInputElement;
    const name = box.name;
    const newValue = box.type === "checkbox" ? box.checked : box.value;

    setForm((previous) => ({
      ...previous,
      [name]: newValue,
      // Ticking "I currently work here" empties the end date.
      ...(name === "current" && newValue === true ? { endDate: "" } : {}),
    }));
  }

  function openForm(experience?: Experience) {
    setEditingId(experience ? experience.id : null);
    setForm(experience ? experienceToForm(experience) : emptyExperienceForm);
    experiences.clearError();
    setIsOpen(true);
  }

  function closeForm() {
    setIsOpen(false);
    experiences.clearError();
  }

  async function handleSave() {
    if (!form.title.trim() || !form.company.trim()) {
      experiences.setError(MESSAGES.PROFILE.EXPERIENCE_REQUIRED);
      return;
    }

    const saved = await experiences.save(formToExperienceBody(form), editingId ?? undefined);
    if (saved) closeForm();
  }

  return (
    <>
      <section id="experience" className="card form-section">
        <div className="card-header flex-between">
          <div>
            <p className="eyebrow">Experience</p>
            <h3>Work experience</h3>
            <p className="muted text-sm">
              Showcase your professional journey, roles, and responsibilities.
            </p>
          </div>

          <button type="button" className="btn-outline btn-sm" onClick={() => openForm()}>
            + Add experience
          </button>
        </div>

        <div className="card-body">
          {experiences.loading ? (
            <p className="muted">Loading experience...</p>
          ) : experiences.items.length === 0 ? (
            <div className="empty-state">
              <h3>No experience added yet</h3>
              <p>
                Add your first role to help recruiters understand your background and
                professional growth.
              </p>

              <button type="button" className="btn-primary" onClick={() => openForm()}>
                Add first experience
              </button>
            </div>
          ) : (
            <div className="experience-list">
              {experiences.items.map((experience) => (
                <ExperienceCard
                  key={experience.id}
                  experience={experience}
                  busy={experiences.saving}
                  onEdit={openForm}
                  onDelete={experiences.remove}
                />
              ))}
            </div>
          )}

          {/* While the pop-up is open, it shows the error itself. */}
          {!isOpen && experiences.error && (
            <p className="form-error mt-2" role="alert">
              {experiences.error}
            </p>
          )}
        </div>
      </section>

      {isOpen && (
        <ExperienceModal
          isEditing={editingId !== null}
          form={form}
          error={experiences.error}
          saving={experiences.saving}
          onChange={handleFormChange}
          onSave={handleSave}
          onClose={closeForm}
        />
      )}
    </>
  );
}
