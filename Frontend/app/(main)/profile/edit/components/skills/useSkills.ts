"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "../../../../../api/client";
import type { Skill, SkillFormState } from "./skillTypes";

type UseSkillsOptions = {
  onProfileChange?: () => void;
  onCountChange?: (count: number) => void;
};

export function useSkills({ onProfileChange, onCountChange }: UseSkillsOptions) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSkills = useCallback(async () => {
    try {
      const res = await apiFetch("/profiles/skills/");

      if (!res.ok) {
        return;
      }

      const data = (await res.json()) as Skill[];
      setSkills(data);
      onCountChange?.(data.length);
    } catch (err) {
      console.error("Failed to load skills:", err);
    }
  }, [onCountChange]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  async function saveSkill(form: SkillFormState, editingSkillId?: number) {
    if (!form.name.trim()) {
      setError("Skill name is required.");
      return false;
    }

    setSaving(true);
    setError("");

    try {
      const url = editingSkillId
        ? `/profiles/skills/${editingSkillId}/update/`
        : "/profiles/skills/add/";

      const res = await apiFetch(url, {
        method: editingSkillId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
        }),
      });

      if (!res.ok) {
        setError("Failed to save skill. Please try again.");
        return false;
      }

      await loadSkills();
      onProfileChange?.();
      return true;
    } catch (err) {
      console.error("Failed to save skill:", err);
      setError("Unable to connect to server.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function deleteSkill(id: number) {
    try {
      const res = await apiFetch(`/profiles/skills/${id}/delete/`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setError("Failed to delete skill. Please try again.");
        return;
      }

      await loadSkills();
      onProfileChange?.();
    } catch (err) {
      console.error("Failed to delete skill:", err);
      setError("Unable to delete skill.");
    }
  }

  function clearError() {
    setError("");
  }

  return {
    skills,
    error,
    saving,
    saveSkill,
    deleteSkill,
    clearError,
  };
}