import { ROUTES } from "@/app/config/routes";

/**
 * Where to fix each checklist item on the edit page.
 * The labels come from Django (Backend/profiles/utils.py). The "#about"
 * part scrolls the edit page to that section.
 */
const SECTION_FOR_ITEM: Record<string, string> = {
  "Full name": "#information",
  Headline: "#information",
  "Recruiter headline": "#information",
  Location: "#information",
  Bio: "#about",
  "LinkedIn profile": "#social",
  CV: "#resume",
  Skills: "#skills",
  Projects: "#projects",
  Experience: "#experience",
  "Company name": "#company",
  "Hiring title": "#company",
  "Company website": "#company",
  "About the company": "#company",
  "Roles you hire for": "#hiring",
  "Admin title": "#admin",
};

/** The edit-page address for one checklist item, e.g. "/profile/edit#resume". */
export function linkForChecklistItem(label: string): string {
  return `${ROUTES.PROFILE_EDIT}${SECTION_FOR_ITEM[label] ?? ""}`;
}

/** "Bio" -> "Add a bio", "CV" -> "Add your CV". Short, clear button text. */
export function actionForChecklistItem(label: string): string {
  const special: Record<string, string> = {
    CV: "Upload your CV",
    Skills: "Add skills",
    Projects: "Add a project",
    Experience: "Add work experience",
    "LinkedIn profile": "Add your LinkedIn",
    "About the company": "Describe your company",
    "Roles you hire for": "Add roles you hire for",
  };
  return special[label] ?? `Add ${label.toLowerCase()}`;
}
