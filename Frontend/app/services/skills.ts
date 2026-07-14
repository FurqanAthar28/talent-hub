import { apiFetch } from "../api/client";

export type Skill = {
  id: number;
  name: string;
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error("Request failed.");
  }

  return response.json();
}

export async function getSkillOptions(): Promise<string[]> {
  const response = await apiFetch("/profiles/skills/options/");
  const data = await parseResponse<unknown>(response);

  if (Array.isArray(data)) {
    return data as string[];
  }

  if (
    data &&
    typeof data === "object" &&
    "skills" in data &&
    Array.isArray((data as { skills: unknown }).skills)
  ) {
    return (data as { skills: string[] }).skills;
  }

  if (
    data &&
    typeof data === "object" &&
    "options" in data &&
    Array.isArray((data as { options: unknown }).options)
  ) {
    return (data as { options: string[] }).options;
  }

  return [];
}

export async function getProfileSkills(): Promise<Skill[]> {
  const response = await apiFetch("/profiles/skills/");
  return parseResponse<Skill[]>(response);
}

export async function addProfileSkill(name: string): Promise<Skill> {
  const response = await apiFetch("/profiles/skills/add/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  return parseResponse<Skill>(response);
}

export async function deleteProfileSkill(skillId: number): Promise<void> {
  const response = await apiFetch(`/profiles/skills/${skillId}/delete/`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete skill.");
  }
}