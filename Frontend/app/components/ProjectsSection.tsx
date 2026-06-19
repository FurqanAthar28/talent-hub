'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

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
  title: '',
  description: '',
  techStack: '',
  githubUrl: '',
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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const res = await apiFetch('/profiles/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        onCountChange?.(data.length);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }, [onCountChange]);

 useEffect(() => {
  async function loadInitialProjects() {
    await loadProjects();
  }

  loadInitialProjects();
}, [loadProjects]);

  function handleFormChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleOpen(project?: Project) {
    if (project) {
      setEditing(project);
      setForm({
        title: project.title,
        description: project.description,
        techStack: project.tech_stack.join(', '),
        githubUrl: project.github_url,
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }

    setError('');
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
    setError('');
  }

  async function handleSave() {
    if (!form.title.trim()) return;

    setSaving(true);
    setError('');

    try {
      const url = editing
        ? `/profiles/projects/${editing.id}/update`
        : '/profiles/projects/add';

      const res = await apiFetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          tech_stack: form.techStack
            .split(',')
            .map((tech) => tech.trim())
            .filter(Boolean),
          github_url: form.githubUrl.trim(),
        }),
      });

      if (!res.ok) {
        setError('Failed to save project. Please try again.');
        return;
      }

      await loadProjects();
      onProfileChange?.();
      handleClose();
    } catch (err) {
      console.error('Failed to save project:', err);
      setError('Unable to connect to server.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await apiFetch(`/profiles/projects/${id}/delete`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        console.error('Failed to delete project');
        return;
      }

      await loadProjects();
      onProfileChange?.();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  }

  return (
    <div className="card">
      <div className="card-header flex-between">
        <h3>Projects</h3>

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
          <p className="muted text-center">
            No projects yet. Add your first project.
          </p>
        ) : (
          <div className="project-list">
            {projects.map((project) => (
              <div key={project.id} className="project-item">
                <div className="flex-between mb-2 project-item-header">
                  <h4 className="font-semibold">{project.title}</h4>

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
                      className="btn-outline btn-sm"
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
                    GitHub
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="modal-overlay" onClick={handleClose}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{editing ? 'Edit Project' : 'Add Project'}</h3>

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
                <label>
                  Title <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleFormChange}
                  placeholder="E-commerce Platform"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="Built a full-stack e-commerce app..."
                />
              </div>

              <div className="form-group">
                <label>Tech Stack</label>
                <input
                  type="text"
                  name="techStack"
                  value={form.techStack}
                  onChange={handleFormChange}
                  placeholder="React, Django, SQLite"
                />
              </div>

              <div className="form-group">
                <label>GitHub URL</label>
                <input
                  type="url"
                  name="githubUrl"
                  value={form.githubUrl}
                  onChange={handleFormChange}
                  placeholder="https://github.com/username/repo"
                />
              </div>

              {error && <p className="form-error text-sm">{error}</p>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={!form.title.trim() || saving}
                >
                  {saving ? 'Saving...' : 'Save Project'}
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
    </div>
  );
}