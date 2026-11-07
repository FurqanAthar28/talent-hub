import type { ChangeEvent } from "react";

/** Every box in the main "edit profile" form. */
export type ProfileFormData = {
  fullName: string;
  headline: string;
  location: string;
  bio: string;
  openToWork: boolean;
  linkedinUrl: string;
  githubUrl: string;
  companyName: string;
  companyWebsite: string;
  companyLocation: string;
  hiringTitle: string;
  companyAbout: string;
  companyIndustry: string;
  companySize: string;
  companyLinkedinUrl: string;
  workStyles: string[];
  hiringNow: boolean;
  hiringRoles: string[];
  hiringSkills: string[];
  hiringLocations: string[];
  hiringLevels: string[];
  adminTitle: string;
};

/** The boxes that hold a list (chips), not text. */
export type ListFieldName = "workStyles" | "hiringRoles" | "hiringSkills" | "hiringLocations" | "hiringLevels";

/** Recruiter sections also change lists, so they get this as well. */
export type SetListField = (name: ListFieldName, value: string[]) => void;

/** Texts admins can edit, like { fullName: "Full name" }. */
export type UiTexts = Record<string, string | undefined>;

/** The one change handler every section uses. */
export type FormChangeHandler = (
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
) => void;

/** What most sections receive. */
export type SectionProps = {
  content: UiTexts;
  formData: ProfileFormData;
  handleChange: FormChangeHandler;
};
