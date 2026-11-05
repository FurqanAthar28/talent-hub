/**
 * Talking to Django about MY skills.
 * Each function throws an Error with Django's own message when something
 * goes wrong, so the page can simply show `error.message`.
 */

import { apiFetch, getApiMessage, readJson } from "../api/client";
import { API_ROUTES } from "../config/apiRoutes";

export type Skill = {
  id: number;
  name: string;
};

/** Stop here if Django said "no", using Django's message when it sent one. */
async function throwIfFailed(response: Response, fallback: string) {
  if (response.ok) return;

  const data = await readJson(response);
  throw new Error(getApiMessage(data) || fallback);
}

/** The suggested skills for the "add skill" box, like ["Python", "React"]. */
export async function getSkillOptions(): Promise<string[]> {
  const response = await apiFetch(API_ROUTES.PROFILES.SKILL_OPTIONS);
  await throwIfFailed(response, "Couldn't load skill suggestions.");

  const data: unknown = await response.json();
  return Array.isArray(data) ? data.filter((item) => typeof item === "string") : [];
}

export async function getProfileSkills(): Promise<Skill[]> {
  const response = await apiFetch(API_ROUTES.PROFILES.SKILLS);
  await throwIfFailed(response, "Couldn't load your skills.");

  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as Skill[]) : [];
}

export async function addProfileSkill(name: string): Promise<Skill> {
  const response = await apiFetch(API_ROUTES.PROFILES.SKILL_ADD, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  await throwIfFailed(response, "Couldn't add the skill.");

  return (await response.json()) as Skill;
}

export async function deleteProfileSkill(skillId: number): Promise<void> {
  const response = await apiFetch(API_ROUTES.PROFILES.SKILL_DELETE(skillId), {
    method: "DELETE",
  });
  await throwIfFailed(response, "Couldn't remove the skill.");
}
