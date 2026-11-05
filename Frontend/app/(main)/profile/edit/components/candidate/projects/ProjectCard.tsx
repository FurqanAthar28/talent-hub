"use client";

import type { Project } from "./projectTypes";

type ProjectCardProps = {
  project: Project;
  busy: boolean; // true while something is saving: buttons are switched off
  onEdit: (project: Project) => void;
  onDelete: (projectId: number) => void;
};

export default function ProjectCard({ project, busy, onEdit, onDelete }: ProjectCardProps) {
  return (
    <article className="project-item">
      <div className="flex-between mb-2 project-item-header">
        <div>
          <h4 className="font-semibold">{project.title}</h4>
          <p className="text-xs muted">Portfolio project</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => onEdit(project)}
            disabled={busy}
          >
            Edit
          </button>

          <button
            type="button"
            className="btn-danger-outline btn-sm"
            onClick={() => onDelete(project.id)}
            disabled={busy}
            aria-label={`Delete ${project.title}`}
          >
            Delete
          </button>
        </div>
      </div>

      {project.description && <p className="muted mb-2">{project.description}</p>}

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
        // noopener noreferrer: the other site can't control this tab.
        <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="text-sm">
          View GitHub repository
        </a>
      )}
    </article>
  );
}
