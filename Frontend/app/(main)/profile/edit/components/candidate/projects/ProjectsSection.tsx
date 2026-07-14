"use client";

import { useState } from "react";

import ProjectCard from "./ProjectCard";
import ProjectModal from "./ProjectModal";
import {
  emptyProjectForm,
  type Project,
  type ProjectFormState,
} from "./projectTypes";
import { useProjects } from "./useProjects";

type ProjectsSectionProps = {
  onProfileChange?: () => void;
  onCountChange?: (count: number) => void;
};

export default function ProjectsSection({
  onProfileChange,
  onCountChange,
}: ProjectsSectionProps) {
  const { projects, error, saving, saveProject, deleteProject, clearError } =
    useProjects({
      onProfileChange,
      onCountChange,
    });

  const [isOpen, setIsOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectFormState>(emptyProjectForm);

  function handleFormChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleOpen(project?: Project) {
    if (project) {
      setEditingProject(project);
      setForm({
        title: project.title,
        description: project.description,
        techStack: project.tech_stack.join(", "),
        githubUrl: project.github_url,
      });
    } else {
      setEditingProject(null);
      setForm(emptyProjectForm);
    }

    clearError();
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
    setEditingProject(null);
    setForm(emptyProjectForm);
    clearError();
  }

  async function handleSave() {
    const saved = await saveProject(form, editingProject?.id);

    if (saved) {
      handleClose();
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
                <ProjectCard
                  key={project.id}
                  project={project}
                  onEdit={handleOpen}
                  onDelete={deleteProject}
                />
              ))}
            </div>
          )}

          {error && <p className="form-error mt-2">{error}</p>}
        </div>
      </section>

      {isOpen && (
        <ProjectModal
          editingProject={editingProject}
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