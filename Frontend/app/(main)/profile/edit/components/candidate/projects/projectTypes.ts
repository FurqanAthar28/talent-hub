/**
 * Everything about the "project" data in one place:
 * its shape, the empty form, the Django addresses, and how to turn
 * a project into form values (and back).
 */

import { API_ROUTES } from "@/app/config/apiRoutes";
import type { ListRoutes } from "../useProfileList";

/** A project as Django sends it (snake_case names, like the database). */
export type Project = {
  id: number;
  title: string;
  description: string;
  tech_stack: string[];
  github_url: string;
};

/** What the form boxes hold. Technologies are ONE text: "Django, React". */
export type ProjectFormState = {
  title: string;
  description: string;
  techStack: string;
  githubUrl: string;
};

export const emptyProjectForm: ProjectFormState = {
  title: "",
  description: "",
  techStack: "",
  githubUrl: "",
};

export const PROJECT_ROUTES: ListRoutes = {
  list: API_ROUTES.PROFILES.PROJECTS,
  add: API_ROUTES.PROFILES.PROJECT_ADD,
  update: API_ROUTES.PROFILES.PROJECT_UPDATE,
  remove: API_ROUTES.PROFILES.PROJECT_DELETE,
};

/** Project from Django -> values for the form (to edit it). */
export function projectToForm(project: Project): ProjectFormState {
  return {
    title: project.title,
    description: project.description,
    techStack: project.tech_stack.join(", "),
    githubUrl: project.github_url,
  };
}

/** Form values -> the JSON Django expects. */
export function formToProjectBody(form: ProjectFormState) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    // "Django, React, " -> ["Django", "React"]
    tech_stack: form.techStack
      .split(",")
      .map((tech) => tech.trim())
      .filter(Boolean),
    github_url: form.githubUrl.trim(),
  };
}
