export type Project = {
  id: number;
  title: string;
  description: string;
  tech_stack: string[];
  github_url: string;
};

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