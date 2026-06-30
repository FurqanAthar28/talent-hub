"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api/client";

type Project = {
  id: number;
  title: string;
  description: string;
  tech_stack: string[];
  github_url: string;
};

type FormState = {
  title: string;
  description: string;
  techStack: string;
  githubUrl: string;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  techStack: "",
  githubUrl: "",
};

export default function ProjectsSection({
  onProfileChange,
  onCountChange,
}: {
  onProfileChange?: () => void;
  onCountChange?: (count: number) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const res = await apiFetch("/profiles/projects");

      if (!res.ok) {
        return;
      }

      const data = await res.json();
      setProjects(data);
      onCountChange?.(data.length);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  }, [onCountChange]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  function handleFormChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleOpen(project?: Project) {
    if (project) {
      setEditing(project);
      setForm({
        title: project.title,
        description: project.description,
        techStack: project.tech_stack.join(", "),
        githubUrl: project.github_url,
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }

    setError("");
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
    setError("");
    setForm(emptyForm);
    setEditing(null);
  }

  async function handleSave() {
    const title = form.title.trim();

    if (!title) {
      setError("Project title is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = editing
        ? `/profiles/projects/${editing.id}/update`
        : "/profiles/projects/add";

      const res = await apiFetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: form.description.trim(),
          tech_stack: form.techStack
            .split(",")
            .map((tech) => tech.trim())
            .filter(Boolean),
          github_url: form.githubUrl.trim(),
        }),
      });

      if (!res.ok) {
        setError("Failed to save project. Please try again.");
        return;
      }

      await loadProjects();
      onProfileChange?.();
      handleClose();
    } catch (err) {
      console.error("Failed to save project:", err);
      setError("Unable to connect to server.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await apiFetch(`/profiles/projects/${id}/delete`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setError("Failed to delete project. Please try again.");
        return;
      }

      await loadProjects();
      onProfileChange?.();
    } catch (err) {
      console.error("Failed to delete project:", err);
      setError("Unable to delete project.");
    }
  }

  return (
    <>
      <section id="projects" className="card form-section">
        <div className="card-header flex-between">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h3>Projects</h3>
            <p className="muted text-sm">
              Showcase your best work, tools used, and links recruiters can
              review.
            </p>
          </div>

          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => handleOpen()}
          >
            + Add Project
          </button>
        </div>

        <div className="card-body">
          {projects.length === 0 ? (
            <div className="empty-state">
              <h3>No projects added yet</h3>
              <p>
                Add a project to show your practical experience and technical
                skills.
              </p>

              <button
                type="button"
                className="btn-primary"
                onClick={() => handleOpen()}
              >
                Add First Project
              </button>
            </div>
          ) : (
            <div className="project-list">
              {projects.map((project) => (
                <article key={project.id} className="project-item">
                  <div className="flex-between mb-2 project-item-header">
                    <div>
                      <h4 className="font-semibold">{project.title}</h4>
                      <p className="text-xs muted">Portfolio project</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        onClick={() => handleOpen(project)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => handleDelete(project.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {project.description && (
                    <p className="muted mb-2">{project.description}</p>
                  )}

                  {project.tech_stack.length > 0 && (
                    <div className="skill-tags mb-2">
                      {project.tech_stack.map((tech) => (
                        <span key={tech} className="skill-tag">
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}

                  {project.github_url && (
                    <a
                      href={project.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm"
                    >
                      View GitHub Repository
                    </a>
                  )}
                </article>
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
                <p className="eyebrow">
                  {editing ? "Edit Project" : "Add Project"}
                </p>
                <h3>{editing ? "Update project details" : "Add a project"}</h3>
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
                    onChange={handleFormChange}
                    placeholder="Example: ProfessionalHub"
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <p className="form-help">
                    Briefly explain what the project does, your role, and the
                    main features.
                  </p>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleFormChange}
                    rows={4}
                    placeholder="Built a full-stack professional networking platform using Django and Next.js."
                  />

                  <div className="ai-assist-row">
                    <p className="character-count">
                      {form.description.length} characters
                    </p>

                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      disabled
                    >
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
                    onChange={handleFormChange}
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
                    onChange={handleFormChange}
                    placeholder="https://github.com/username/repository"
                  />
                </div>
              </div>

              {error && <p className="form-error text-sm">{error}</p>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={!form.title.trim() || saving}
                >
                  {saving ? "Saving..." : editing ? "Update Project" : "Save Project"}
                </button>

                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleClose}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}