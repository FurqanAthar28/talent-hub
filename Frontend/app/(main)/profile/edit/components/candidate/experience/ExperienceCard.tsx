"use client";

import {
  getExperienceDuration,
  type Experience,
} from "./experienceTypes";

type ExperienceCardProps = {
  experience: Experience;
  onEdit: (experience: Experience) => void;
  onDelete: (experienceId: number) => void;
};

export default function ExperienceCard({
  experience,
  onEdit,
  onDelete,
}: ExperienceCardProps) {
  return (
    <article className="experience-card">
      <div className="experience-card-header">
        <div>
          <h4>{experience.title}</h4>
          <p className="muted">{experience.company}</p>
        </div>

        {experience.current && <span className="status-pill">Current</span>}
      </div>

      <div className="experience-meta">
        <span>{getExperienceDuration(experience)}</span>

        {experience.location && <span>{experience.location}</span>}
      </div>

      {experience.description && (
        <p className="experience-description">{experience.description}</p>
      )}

      <div className="experience-actions">
        <button
          type="button"
          className="btn-outline btn-sm"
          onClick={() => onEdit(experience)}
        >
          Edit
        </button>

        <button
          type="button"
          className="btn-danger-outline btn-sm"
          onClick={() => onDelete(experience.id)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}