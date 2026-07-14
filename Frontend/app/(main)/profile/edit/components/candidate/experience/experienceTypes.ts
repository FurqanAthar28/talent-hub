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

export function getExperienceDuration(experience: Experience) {
  const startDate = experience.start_date || "Start date";

  const endDate = experience.current
    ? "Present"
    : experience.end_date || "End date";

  return `${startDate} — ${endDate}`;
}