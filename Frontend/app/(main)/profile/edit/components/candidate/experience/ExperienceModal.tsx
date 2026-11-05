"use client";

/** The "Add / Edit experience" pop-up. FormModal does the pop-up work. */

import type { ChangeEvent } from "react";

import FormModal from "../FormModal";
import type { ExperienceFormState } from "./experienceTypes";

type ExperienceModalProps = {
  isEditing: boolean;
  form: ExperienceFormState;
  error: string;
  saving: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSave: () => void;
  onClose: () => void;
};

export default function ExperienceModal({
  isEditing,
  form,
  error,
  saving,
  onChange,
  onSave,
  onClose,
}: ExperienceModalProps) {
  return (
    <FormModal
      eyebrow="Experience details"
      title={isEditing ? "Edit experience" : "Add experience"}
      error={error}
      saving={saving}
      saveLabel={isEditing ? "Update experience" : "Save experience"}
      canSave={form.title.trim().length > 0 && form.company.trim().length > 0}
      onSave={onSave}
      onClose={onClose}
    >
      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="exp-title">
            Job title <span className="required-star">*</span>
          </label>
          <input
            id="exp-title"
            type="text"
            name="title"
            value={form.title}
            onChange={onChange}
            placeholder="Enter your job title"
            autoFocus
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="exp-company">
            Company <span className="required-star">*</span>
          </label>
          <input
            id="exp-company"
            type="text"
            name="company"
            value={form.company}
            onChange={onChange}
            placeholder="Enter company name"
            autoComplete="organization"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="exp-location">Location</label>
          <input
            id="exp-location"
            type="text"
            name="location"
            value={form.location}
            onChange={onChange}
            placeholder="Enter work location"
          />
        </div>

        <div className="form-group">
          <label htmlFor="exp-start">Start date</label>
          <input
            id="exp-start"
            type="text"
            name="startDate"
            value={form.startDate}
            onChange={onChange}
            placeholder="MM/YYYY or Month YYYY"
          />
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="current"
              checked={form.current}
              onChange={onChange}
            />
            I currently work here
          </label>
        </div>

        {!form.current && (
          <div className="form-group">
            <label htmlFor="exp-end">End date</label>
            <input
              id="exp-end"
              type="text"
              name="endDate"
              value={form.endDate}
              onChange={onChange}
              placeholder="MM/YYYY or Month YYYY"
            />
          </div>
        )}

        <div className="form-group form-group-full">
          <label htmlFor="exp-description">Description</label>
          <textarea
            id="exp-description"
            name="description"
            value={form.description}
            onChange={onChange}
            rows={4}
            placeholder="Briefly describe your responsibilities and achievements"
          />
        </div>
      </div>
    </FormModal>
  );
}
