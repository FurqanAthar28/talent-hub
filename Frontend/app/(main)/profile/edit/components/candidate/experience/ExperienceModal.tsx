"use client";

"use client";

import type { ChangeEvent } from "react";
import type { Experience, ExperienceFormState } from "./experienceTypes";

type ExperienceModalProps = {
  editingExperience: Experience | null;
  form: ExperienceFormState;
  error: string;
  saving: boolean;
onChange: (
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
) => void;
  onSave: () => void;
  onClose: () => void;
};

export default function ExperienceModal({
  editingExperience,
  form,
  error,
  saving,
  onChange,
  onSave,
  onClose,
}: ExperienceModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Experience Details</p>
            <h3>{editingExperience ? "Edit Experience" : "Add Experience"}</h3>
          </div>

          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label>
                Title <span className="required-star">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={onChange}
                placeholder="Enter your job title"
              />
            </div>

            <div className="form-group">
              <label>
                Company <span className="required-star">*</span>
              </label>
              <input
                type="text"
                name="company"
                value={form.company}
                onChange={onChange}
                placeholder="Enter company name"
              />
            </div>

            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={onChange}
                placeholder="Enter work location"
              />
            </div>

            <div className="form-group">
              <label>Start Date</label>
              <input
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
                <label>End Date</label>
                <input
                  type="text"
                  name="endDate"
                  value={form.endDate}
                  onChange={onChange}
                  placeholder="MM/YYYY or Month YYYY"
                />
              </div>
            )}

            <div className="form-group form-group-full">
              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={onChange}
                rows={4}
                placeholder="Briefly describe your responsibilities and achievements"
              />
            </div>
          </div>

          {error && <p className="form-error text-sm">{error}</p>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={onSave}
              disabled={!form.title.trim() || !form.company.trim() || saving}
            >
              {saving ? "Saving..." : "Save Experience"}
            </button>

            <button type="button" className="btn-outline" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}