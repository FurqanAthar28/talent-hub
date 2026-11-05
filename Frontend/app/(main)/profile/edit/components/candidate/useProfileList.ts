"use client";

/**
 * useProfileList: load, add, edit and delete ONE list on my profile
 * (my projects, or my work experience).
 *
 * Projects and experience work exactly the same way, so they share this
 * hook instead of each having its own copy.
 *
 * How to use it:
 *   const list = useProfileList<Project>(PROJECT_ROUTES, onProfileChange);
 *   list.items      -> the projects
 *   list.save(body) -> add a new one (or save(body, id) to edit one)
 *   list.remove(id) -> delete one
 */

import { useEffect, useState } from "react";

import { apiFetch, getApiMessage, readJson } from "@/app/api/client";
import { MESSAGES } from "@/app/config/messages";

/** The 4 Django addresses for one kind of list. */
export type ListRoutes = {
  list: string;
  add: string;
  update: (id: number) => string;
  remove: (id: number) => string;
};

export function useProfileList<Item extends { id: number }>(
  routes: ListRoutes,
  onProfileChange?: () => void
) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load the list once, when the section first appears.
  useEffect(() => {
    // If the user leaves the page before the answer arrives, don't update it.
    let pageIsOpen = true;

    async function loadItems() {
      try {
        const response = await apiFetch(routes.list);
        const data: unknown = response.ok ? await response.json() : null;

        if (!pageIsOpen) return;

        if (Array.isArray(data)) {
          setItems(data as Item[]);
        } else {
          setError(MESSAGES.COMMON.LOAD_FAILED);
        }
      } catch (err) {
        console.error("Failed to load list:", err);
        if (pageIsOpen) setError(MESSAGES.COMMON.LOAD_FAILED);
      } finally {
        if (pageIsOpen) setLoading(false);
      }
    }

    void loadItems();

    return () => {
      pageIsOpen = false;
    };
  }, [routes]);

  /**
   * Add a new item, or edit one when `editingId` is given.
   * Returns true when it worked (so the form can close).
   */
  async function save(body: object, editingId?: number): Promise<boolean> {
    if (saving) return false; // a save is already running: ignore double clicks

    setSaving(true);
    setError("");

    try {
      const isEditing = editingId !== undefined;
      const response = await apiFetch(
        isEditing ? routes.update(editingId) : routes.add,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await readJson(response);

      if (!response.ok) {
        // Show Django's own reason, for example "Title: This field may not be blank."
        setError(getApiMessage(data) || MESSAGES.COMMON.SAVE_FAILED);
        return false;
      }

      // Django sends back the saved item. Put it in our list
      // (no need to download the whole list again).
      const savedItem = data as unknown as Item;
      setItems((previous) =>
        isEditing
          ? previous.map((item) => (item.id === editingId ? savedItem : item))
          : [...previous, savedItem]
      );

      onProfileChange?.(); // e.g. update the "profile complete" bar
      return true;
    } catch (err) {
      console.error("Failed to save:", err);
      setError(MESSAGES.COMMON.SERVER_UNREACHABLE);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (saving) return;
    if (!window.confirm(MESSAGES.COMMON.CONFIRM_DELETE)) return;

    setSaving(true);
    setError("");

    try {
      const response = await apiFetch(routes.remove(id), { method: "DELETE" });

      if (!response.ok) {
        const data = await readJson(response);
        setError(getApiMessage(data) || MESSAGES.COMMON.DELETE_FAILED);
        return;
      }

      setItems((previous) => previous.filter((item) => item.id !== id));
      onProfileChange?.();
    } catch (err) {
      console.error("Failed to delete:", err);
      setError(MESSAGES.COMMON.SERVER_UNREACHABLE);
    } finally {
      setSaving(false);
    }
  }

  return {
    items,
    loading,
    saving,
    error,
    setError,
    clearError: () => setError(""),
    save,
    remove,
  };
}
