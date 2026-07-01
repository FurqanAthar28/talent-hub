"use client";

import type { Project, ProjectFormState } from "./projectTypes";

type ProjectModalProps = {
  editingProject: Project | null;
  form: ProjectFormState;
  error: string;
  saving: boolean;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onSave: () => void;
  onClose: () => void;
};

export default function ProjectModal({
  editingProject,
  form,
  error,
  saving,
  onChange,
  onSave,
  onClose,
}: ProjectModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">
              {editingProject ? "Edit Project" : "Add Project"}
            </p>
            <h3>
              {editingProject ? "Update project details" : "Add a project"}
            </h3>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-section">
            <div className="form-section-header">
              <h3>Project Information</h3>
              <p>Add a clear title and description for your project.</p>
            </div>

            <div className="form-group">
              <label>
                Project Title <span className="required-star">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={onChange}
                placeholder="Example: ProfessionalHub"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <p className="form-help">
                Briefly explain what the project does, your role, and the main
                features.
              </p>

              <textarea
                name="description"
                value={form.description}
                onChange={onChange}
                rows={4}
                placeholder="Built a full-stack professional networking platform using Django and Next.js."
              />

              <div className="ai-assist-row">
                <p className="character-count">
                  {form.description.length} characters
                </p>

                <button type="button" className="btn-secondary btn-sm" disabled>
                  AI Assist Coming Soon
                </button>
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-header">
              <h3>Technology Stack</h3>
              <p>Separate technologies with commas.</p>
            </div>

            <div className="form-group">
              <label>Technologies Used</label>
              <input
                type="text"
                name="techStack"
                value={form.techStack}
                onChange={onChange}
                placeholder="Django, DRF, PostgreSQL, Next.js"
              />
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-header">
              <h3>Project Links</h3>
              <p>Add links that help others review your work.</p>
            </div>

            <div className="form-group">
              <label>GitHub URL</label>
              <input
                type="url"
                name="githubUrl"
                value={form.githubUrl}
                onChange={onChange}
                placeholder="https://github.com/username/repository"
              />
            </div>
          </div>

          {error && <p className="form-error text-sm">{error}</p>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={onSave}
              disabled={!form.title.trim() || saving}
            >
              {saving
                ? "Saving..."
                : editingProject
                  ? "Update Project"
                  : "Save Project"}
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