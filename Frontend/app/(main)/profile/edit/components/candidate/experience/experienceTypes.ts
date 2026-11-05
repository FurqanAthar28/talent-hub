/**
 * Everything about the "work experience" data in one place:
 * its shape, the empty form, the Django addresses, and how to turn
 * an experience into form values (and back).
 */

import { API_ROUTES } from "@/app/config/apiRoutes";
import type { ListRoutes } from "../useProfileList";

/** One job, as Django sends it. Dates are free text, like "03/2024". */
export type Experience = {
  id: number;
  title: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string | null;
  current: boolean;
  description: string;
};

/** What the form boxes hold. */
export type ExperienceFormState = {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
};

export const emptyExperienceForm: ExperienceFormState = {
  title: "",
  company: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  description: "",
};

export const EXPERIENCE_ROUTES: ListRoutes = {
  list: API_ROUTES.PROFILES.EXPERIENCES,
  add: API_ROUTES.PROFILES.EXPERIENCE_ADD,
  update: API_ROUTES.PROFILES.EXPERIENCE_UPDATE,
  remove: API_ROUTES.PROFILES.EXPERIENCE_DELETE,
};

/** Experience from Django -> values for the form (to edit it). */
export function experienceToForm(experience: Experience): ExperienceFormState {
  return {
    title: experience.title,
    company: experience.company,
    location: experience.location,
    startDate: experience.start_date,
    endDate: experience.end_date ?? "",
    current: experience.current,
    description: experience.description,
  };
}

/** Form values -> the JSON Django expects. */
export function formToExperienceBody(form: ExperienceFormState) {
  return {
    title: form.title.trim(),
    company: form.company.trim(),
    location: form.location.trim(),
    start_date: form.startDate.trim(),
    // "I work here now" means there is no end date.
    end_date: form.current ? "" : form.endDate.trim(),
    current: form.current,
    description: form.description.trim(),
  };
}

/** "03/2024 — Present" for the card. */
export function getExperienceDuration(experience: Experience) {
  const start = experience.start_date || "Start date";
  const end = experience.current ? "Present" : experience.end_date || "End date";

  return `${start} — ${end}`;
}
