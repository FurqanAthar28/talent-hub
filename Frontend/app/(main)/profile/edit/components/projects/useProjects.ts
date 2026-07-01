"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "../../../../../api/client";
import type { Project, ProjectFormState } from "./projectTypes";

type UseProjectsOptions = {
  onProfileChange?: () => void;
  onCountChange?: (count: number) => void;
};

export function useProjects({
  onProfileChange,
  onCountChange,
}: UseProjectsOptions) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const res = await apiFetch("/profiles/projects");

      if (!res.ok) {
        return;
      }

      const data = (await res.json()) as Project[];
      setProjects(data);
      onCountChange?.(data.length);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  }, [onCountChange]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function saveProject(
    form: ProjectFormState,
    editingProjectId?: number,
  ) {
    const title = form.title.trim();

    if (!title) {
      setError("Project title is required.");
      return false;
    }

    setSaving(true);
    setError("");

    try {
      const url = editingProjectId
        ? `/profiles/projects/${editingProjectId}/update`
        : "/profiles/projects/add";

      const res = await apiFetch(url, {
        method: editingProjectId ? "PATCH" : "POST",
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
        return false;
      }

      await loadProjects();
      onProfileChange?.();
      return true;
    } catch (err) {
      console.error("Failed to save project:", err);
      setError("Unable to connect to server.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(id: number) {
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

  function clearError() {
    setError("");
  }

  return {
    projects,
    error,
    saving,
    saveProject,
    deleteProject,
    clearError,
  };
}