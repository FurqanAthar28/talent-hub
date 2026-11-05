"use client";

/**
 * "Projects" card on the edit-profile page: a list of my projects,
 * plus a pop-up to add or edit one.
 * Loading and saving are done by useProfileList (shared with Experience).
 */

import { useState, type ChangeEvent } from "react";

import { MESSAGES } from "@/app/config/messages";
import { useProfileList } from "../useProfileList";
import ProjectCard from "./ProjectCard";
import ProjectModal from "./ProjectModal";
import {
  emptyProjectForm,
  formToProjectBody,
  PROJECT_ROUTES,
  projectToForm,
  type Project,
  type ProjectFormState,
} from "./projectTypes";

type ProjectsSectionProps = {
  // Called after a change, so the page can refresh "profile complete" etc.
  onProfileChange?: () => void;
};

export default function ProjectsSection({ onProfileChange }: ProjectsSectionProps) {
  const projects = useProfileList<Project>(PROJECT_ROUTES, onProfileChange);

  const [isOpen, setIsOpen] = useState(false);
  // null = adding a new project; a number = editing that project.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProjectFormState>(emptyProjectForm);

  // One handler for every box: the box's "name" says which field to update.
  function handleFormChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function openForm(project?: Project) {
    setEditingId(project ? project.id : null);
    setForm(project ? projectToForm(project) : emptyProjectForm);
    projects.clearError();
    setIsOpen(true);
  }

  function closeForm() {
    setIsOpen(false);
    projects.clearError();
  }

  async function handleSave() {
    if (!form.title.trim()) {
      projects.setError(MESSAGES.PROFILE.PROJECT_TITLE_REQUIRED);
      return;
    }

    const saved = await projects.save(formToProjectBody(form), editingId ?? undefined);
    if (saved) closeForm();
  }

  return (
    <>
      <section id="projects" className="card form-section">
        <div className="card-header flex-between">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h3>Projects</h3>
            <p className="muted text-sm">
              Showcase your best work, tools used, and links recruiters can review.
            </p>
          </div>

          <button type="button" className="btn-outline btn-sm" onClick={() => openForm()}>
            + Add project
          </button>
        </div>

        <div className="card-body">
          {projects.loading ? (
            <p className="muted">Loading projects...</p>
          ) : projects.items.length === 0 ? (
            <div className="empty-state">
              <h3>No projects added yet</h3>
              <p>Add a project to show your practical experience and technical skills.</p>

              <button type="button" className="btn-primary" onClick={() => openForm()}>
                Add first project
              </button>
            </div>
          ) : (
            <div className="project-list">
              {projects.items.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  busy={projects.saving}
                  onEdit={openForm}
                  onDelete={projects.remove}
                />
              ))}
            </div>
          )}

          {/* While the pop-up is open, it shows the error itself. */}
          {!isOpen && projects.error && (
            <p className="form-error mt-2" role="alert">
              {projects.error}
            </p>
          )}
        </div>
      </section>

      {isOpen && (
        <ProjectModal
          isEditing={editingId !== null}
          form={form}
          error={projects.error}
          saving={projects.saving}
          onChange={handleFormChange}
          onSave={handleSave}
          onClose={closeForm}
        />
      )}
    </>
  );
}
