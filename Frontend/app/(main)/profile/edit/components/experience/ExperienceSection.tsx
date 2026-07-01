"use client";

import { useState, type ChangeEvent } from "react";

import ExperienceCard from "./ExperienceCard";
import ExperienceModal from "./ExperienceModal";
import {
  emptyExperienceForm,
  type Experience,
  type ExperienceFormState,
} from "./experienceTypes";
import { useExperience } from "./useExperience";

type ExperienceSectionProps = {
  onProfileChange?: () => void;
  onCountChange?: (count: number) => void;
};

export default function ExperienceSection({
  onProfileChange,
  onCountChange,
}: ExperienceSectionProps) {
  const {
    experiences,
    error,
    saving,
    saveExperience,
    deleteExperience,
    clearError,
  } = useExperience({
    onProfileChange,
    onCountChange,
  });

  const [isOpen, setIsOpen] = useState(false);
  const [editingExperience, setEditingExperience] =
    useState<Experience | null>(null);
  const [form, setForm] =
    useState<ExperienceFormState>(emptyExperienceForm);

  function handleFormChange(
   event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value, type } = event.target;
    const checked = (event.target as HTMLInputElement).checked;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "current" && checked ? { endDate: "" } : {}),
    }));
  }

  function handleOpen(experience?: Experience) {
    if (experience) {
      setEditingExperience(experience);
      setForm({
        title: experience.title,
        company: experience.company,
        location: experience.location,
        startDate: experience.start_date,
        endDate: experience.end_date ?? "",
        current: experience.current,
        description: experience.description,
      });
    } else {
      setEditingExperience(null);
      setForm(emptyExperienceForm);
    }

    clearError();
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
    setEditingExperience(null);
    setForm(emptyExperienceForm);
    clearError();
  }

  async function handleSave() {
    const saved = await saveExperience(form, editingExperience?.id);

    if (saved) {
      handleClose();
    }
  }

  return (
    <>
      <section id="experience" className="card form-section">
        <div className="card-header flex-between">
          <div>
            <p className="eyebrow">Experience</p>
            <h3>Work Experience</h3>
            <p className="muted text-sm">
              Showcase your professional journey, roles, and responsibilities.
            </p>
          </div>

          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => handleOpen()}
          >
            + Add Experience
          </button>
        </div>

        <div className="card-body">
          {experiences.length === 0 ? (
            <div className="empty-state">
              <h3>No experience added yet</h3>
              <p>
                Add your first role to help recruiters understand your
                background and professional growth.
              </p>

              <button
                type="button"
                className="btn-primary"
                onClick={() => handleOpen()}
              >
                Add First Experience
              </button>
            </div>
          ) : (
            <div className="experience-list">
              {experiences.map((experience) => (
                <ExperienceCard
                  key={experience.id}
                  experience={experience}
                  onEdit={handleOpen}
                  onDelete={deleteExperience}
                />
              ))}
            </div>
          )}

          {error && <p className="form-error mt-2">{error}</p>}
        </div>
      </section>

      {isOpen && (
        <ExperienceModal
          editingExperience={editingExperience}
          form={form}
          error={error}
          saving={saving}
          onChange={handleFormChange}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}
    </>
  );
}