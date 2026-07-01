"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "../../../../../api/client";
import type { Experience, ExperienceFormState } from "./experienceTypes";

type UseExperienceOptions = {
  onProfileChange?: () => void;
  onCountChange?: (count: number) => void;
};

export function useExperience({
  onProfileChange,
  onCountChange,
}: UseExperienceOptions) {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadExperiences = useCallback(async () => {
    try {
      const res = await apiFetch("/profiles/experiences/");

      if (!res.ok) {
        return;
      }

      const data = (await res.json()) as Experience[];
      setExperiences(data);
      onCountChange?.(data.length);
    } catch (err) {
      console.error("Failed to load experiences:", err);
    }
  }, [onCountChange]);

  useEffect(() => {
    loadExperiences();
  }, [loadExperiences]);

  async function saveExperience(
    form: ExperienceFormState,
    editingExperienceId?: number,
  ) {
    if (!form.title.trim() || !form.company.trim()) {
      setError("Title and company are required.");
      return false;
    }

    setSaving(true);
    setError("");

    try {
      const url = editingExperienceId
        ? `/profiles/experiences/${editingExperienceId}/update/`
        : "/profiles/experiences/add/";

      const res = await apiFetch(url, {
        method: editingExperienceId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          company: form.company.trim(),
          location: form.location.trim(),
          start_date: form.startDate.trim(),
          end_date: form.current ? null : form.endDate.trim() || null,
          current: form.current,
          description: form.description.trim(),
        }),
      });

      if (!res.ok) {
        setError("Failed to save experience. Please try again.");
        return false;
      }

      await loadExperiences();
      onProfileChange?.();
      return true;
    } catch (err) {
      console.error("Failed to save experience:", err);
      setError("Unable to connect to server.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function deleteExperience(id: number) {
    try {
      const res = await apiFetch(`/profiles/experiences/${id}/delete/`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setError("Failed to delete experience. Please try again.");
        return;
      }

      await loadExperiences();
      onProfileChange?.();
    } catch (err) {
      console.error("Failed to delete experience:", err);
      setError("Unable to delete experience.");
    }
  }

  function clearError() {
    setError("");
  }

  return {
    experiences,
    error,
    saving,
    saveExperience,
    deleteExperience,
    clearError,
  };
}