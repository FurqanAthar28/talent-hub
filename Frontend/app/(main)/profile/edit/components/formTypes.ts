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
  adminTitle: string;
};

/** Texts admins can edit, like { fullName: "Full name" }. */
export type UiTexts = Record<string, string | undefined>;

/** The one change handler every section uses. */
export type FormChangeHandler = (
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
) => void;

/** What most sections receive. */
export type SectionProps = {
  content: UiTexts;
  formData: ProfileFormData;
  handleChange: FormChangeHandler;
};
