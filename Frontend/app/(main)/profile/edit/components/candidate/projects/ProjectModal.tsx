"use client";

/** The "Add / Edit project" pop-up. FormModal does the pop-up work. */

import type { ChangeEvent } from "react";

import FormModal from "../FormModal";
import type { ProjectFormState } from "./projectTypes";

type ProjectModalProps = {
  isEditing: boolean;
  form: ProjectFormState;
  error: string;
  saving: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSave: () => void;
  onClose: () => void;
};

export default function ProjectModal({
  isEditing,
  form,
  error,
  saving,
  onChange,
  onSave,
  onClose,
}: ProjectModalProps) {
  return (
    <FormModal
      eyebrow={isEditing ? "Edit project" : "Add project"}
      title={isEditing ? "Update project details" : "Add a project"}
      error={error}
      saving={saving}
      saveLabel={isEditing ? "Update project" : "Save project"}
      canSave={form.title.trim().length > 0}
      onSave={onSave}
      onClose={onClose}
    >
      <div className="form-section">
        <div className="form-section-header">
          <h3>Project information</h3>
          <p>Add a clear title and description for your project.</p>
        </div>

        <div className="form-group">
          {/* htmlFor + id link the label to its box (clicking the label focuses it). */}
          <label htmlFor="project-title">
            Project title <span className="required-star">*</span>
          </label>
          <input
            id="project-title"
            type="text"
            name="title"
            value={form.title}
            onChange={onChange}
            placeholder="Project title"
            autoFocus
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="project-description">Description</label>
          <p className="form-help">
            Briefly explain what the project does, your role, and the main features.
          </p>
          <textarea
            id="project-description"
            name="description"
            value={form.description}
            onChange={onChange}
            rows={4}
            placeholder="The problem, your role, and the result."
          />
          <p className="character-count">{form.description.length} characters</p>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-header">
          <h3>Technology stack</h3>
          <p>Separate technologies with commas.</p>
        </div>

        <div className="form-group">
          <label htmlFor="project-tech">Technologies used</label>
          <input
            id="project-tech"
            type="text"
            name="techStack"
            value={form.techStack}
            onChange={onChange}
            placeholder="For example: Django, React, PostgreSQL"
          />
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-header">
          <h3>Project links</h3>
          <p>Add links that help others review your work.</p>
        </div>

        <div className="form-group">
          <label htmlFor="project-github">GitHub URL</label>
          <input
            id="project-github"
            type="url"
            name="githubUrl"
            value={form.githubUrl}
            onChange={onChange}
            placeholder="https://github.com/username/repository"
          />
        </div>
      </div>
    </FormModal>
  );
}
