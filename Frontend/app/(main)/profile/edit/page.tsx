"use client";

/**
 * Edit my profile.
 *
 * TWO KINDS OF SAVING ON THIS PAGE
 * 1. The main form (name, bio, links, CV...) saves when you press "Save changes".
 * 2. Skills, projects and experience save STRAIGHT AWAY when you add or
 *    remove one. So they sit BELOW the main form, not inside it. (Before,
 *    they were inside it, which made "Save changes" look like it saved them.)
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import { apiFetch, backendUrl, errorText, getApiMessage, readJson } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { MESSAGES } from "../../../config/messages";
import { ROUTES } from "../../../config/routes";
import { useUiContentRecord } from "../../../hooks/useUiContent";
import type { Profile } from "../../../services/profiles";
import { Notice, Page, ui } from "../../../components/ui";
import { useToast } from "../../../components/ToastProvider";
import styles from "./edit.module.css";
import AboutSection from "./components/candidate/AboutSection";
import { useAiWriter } from "./components/candidate/ai/AiWriter";
import BasicInfoSection from "./components/candidate/BasicInfoSection";
import ExperienceSection from "./components/candidate/experience/ExperienceSection";
import ProjectsSection from "./components/candidate/projects/ProjectsSection";
import ResumeSection from "./components/candidate/ResumeSection";
import SkillsSection from "./components/candidate/skills/SkillsSection";
import SocialLinksSection from "./components/candidate/SocialLinksSection";
import DeleteAccountSection from "./components/DeleteAccountSection";
import type { ProfileFormData, SetListField } from "./components/formTypes";
import CompanyInformationSection from "./components/recruiter/CompanyInformationSection";
import HiringSection from "./components/recruiter/HiringSection";

/** Profile from Django -> values for the form boxes. */
function profileToForm(profile: Profile): ProfileFormData {
  return {
    fullName: profile.fullName || "",
    headline: profile.headline || "",
    location: profile.location || "",
    bio: profile.bio || "",
    openToWork: profile.openToWork ?? false,
    linkedinUrl: profile.linkedinUrl || "",
    githubUrl: profile.githubUrl || "",
    companyName: profile.companyName || "",
    companyWebsite: profile.companyWebsite || "",
    companyLocation: profile.companyLocation || "",
    hiringTitle: profile.hiringTitle || "",
    companyAbout: profile.companyAbout || "",
    companyIndustry: profile.companyIndustry || "",
    companySize: profile.companySize || "",
    companyLinkedinUrl: profile.companyLinkedinUrl || "",
    workStyles: profile.workStyles ?? [],
    hiringNow: profile.hiringNow ?? true,
    hiringRoles: profile.hiringRoles ?? [],
    hiringSkills: profile.hiringSkills ?? [],
    hiringLocations: profile.hiringLocations ?? [],
    hiringLevels: profile.hiringLevels ?? [],
    adminTitle: profile.adminTitle || "",
  };
}

/**
 * Form values -> FormData for Django. Each role only sends its own fields.
 * (FormData, not JSON, because it can carry the CV file.)
 */
function formToRequestBody(form: ProfileFormData, role: Profile["role"], cvFile: File | null) {
  const body = new FormData();

  body.append("fullName", form.fullName.trim());
  body.append("headline", form.headline.trim());
  body.append("location", form.location.trim());
  body.append("bio", form.bio.trim());

  if (role === "candidate") {
    body.append("openToWork", String(form.openToWork)); // "true" or "false"
    body.append("linkedinUrl", form.linkedinUrl.trim());
    body.append("githubUrl", form.githubUrl.trim());

    if (cvFile) body.append("cvFile", cvFile);
  }

  if (role === "recruiter") {
    body.append("companyName", form.companyName.trim());
    body.append("companyWebsite", form.companyWebsite.trim());
    body.append("companyLocation", form.companyLocation.trim());
    body.append("hiringTitle", form.hiringTitle.trim());
    body.append("companyAbout", form.companyAbout.trim());
    body.append("companyIndustry", form.companyIndustry.trim());
    body.append("companySize", form.companySize);
    body.append("companyLinkedinUrl", form.companyLinkedinUrl.trim());
    body.append("hiringNow", String(form.hiringNow));
    // FormData can't hold a list, so lists go as JSON text: '["Backend Engineer"]'.
    body.append("workStyles", JSON.stringify(form.workStyles));
    body.append("hiringRoles", JSON.stringify(form.hiringRoles));
    body.append("hiringSkills", JSON.stringify(form.hiringSkills));
    body.append("hiringLocations", JSON.stringify(form.hiringLocations));
    body.append("hiringLevels", JSON.stringify(form.hiringLevels));
  }

  if (role === "admin") {
    body.append("adminTitle", form.adminTitle.trim());
  }

  return body;
}

export default function EditProfilePage() {
  const router = useRouter();
  const content = useUiContentRecord();
  const showToast = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<ProfileFormData | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Picking an AI option only fills the box. "Save changes" still does the saving.
  const aiWriter = useAiWriter((field, text) => {
    setFormData((previous) => (previous ? { ...previous, [field]: text } : previous));
  });

  // Load my profile once and fill the form.
  useEffect(() => {
    let pageIsOpen = true;

    async function loadProfile() {
      try {
        const response = await apiFetch(API_ROUTES.PROFILES.ME);
        const data = await readJson(response);

        if (!response.ok) throw new Error(getApiMessage(data));
        if (!pageIsOpen) return;

        const loaded = data as unknown as Profile;
        setProfile(loaded);
        setFormData(profileToForm(loaded));
      } catch (loadError) {
        if (pageIsOpen) setError(errorText(loadError, MESSAGES.PROFILE.LOAD_ERROR));
      }
    }

    void loadProfile();

    return () => {
      pageIsOpen = false;
    };
  }, []);

  // Links like /profile/edit#skills: scroll to that section once the page is drawn.
  const isReady = formData !== null;
  useEffect(() => {
    if (!isReady || !window.location.hash) return;
    document.querySelector(window.location.hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isReady]);

  
  async function refreshProfileSummary() {
    try {
      const response = await apiFetch(API_ROUTES.PROFILES.ME);
      if (response.ok) setProfile((await response.json()) as Profile);
    } catch (refreshError) {
      console.warn("Couldn't refresh the profile summary:", refreshError);
    }
  }

  /** Chip lists (roles, skills, ...) change as a whole list, not from one box. */
  const setListField: SetListField = (name, value) => {
    setFormData((previous) => (previous ? { ...previous, [name]: value } : previous));
  };

  // One handler for every box. A checkbox gives true/false, the others give text.
  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const box = event.target as HTMLInputElement;
    const value = box.type === "checkbox" ? box.checked : box.value;

    setFormData((previous) => (previous ? { ...previous, [box.name]: value } : previous));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !profile || !formData) return; // no double saves

    if (!formData.fullName.trim()) {
      setError(MESSAGES.PROFILE.NAME_REQUIRED);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await apiFetch(API_ROUTES.PROFILES.UPDATE_ME, {
        method: "PATCH",
        body: formToRequestBody(formData, profile.role, cvFile),
      });

      if (!response.ok) {
        // Django's reason, for example "Headline: Ensure this field has no more than 120 characters."
        const data = await readJson(response);
        setError(getApiMessage(data) || MESSAGES.PROFILE.UPDATE_ERROR);
        return;
      }

      router.push(ROUTES.PROFILE);
      showToast("Profile changes saved.");
    } catch {
      setError(MESSAGES.COMMON.SERVER_UNREACHABLE);
    } finally {
      setSaving(false);
    }
  }

  if (!profile || !formData) {
    return (
      <main className={ui.page}>
        {error ? <Notice tone="error">{error}</Notice> : <p className="muted">{content.loading || "Loading profile..."}</p>}
      </main>
    );
  }

  const isCandidate = profile.role === "candidate";
  const sectionProps = { content, formData, handleChange };

  // The side menu: one link per section on this page ("#about" scrolls there).
  const sections = [
    { id: "information", label: "Basic details" },
    { id: "about", label: "About" },
    ...(isCandidate
      ? [
          { id: "social", label: "Links" },
          { id: "resume", label: "CV" },
          { id: "skills", label: "Skills" },
          { id: "projects", label: "Projects" },
          { id: "experience", label: "Experience" },
        ]
      : []),
    ...(profile.role === "recruiter"
      ? [
          { id: "company", label: "Company" },
          { id: "hiring", label: "Hiring for" },
        ]
      : []),
    ...(profile.role === "admin" ? [{ id: "admin", label: "Admin role" }] : []),
  ];

  return (
    <Page
      title={content.editProfileTitle || "Edit profile"}
      subtitle={content.editProfileDescription || "Keep your professional information complete and up to date."}
      actions={
        <Link href={ROUTES.PROFILE} className="btn-outline">
          View profile
        </Link>
      }
    >
      <div className={styles.layout}>
        {/* ---------- Side menu ---------- */}
        <nav className={styles.nav} aria-label="Profile sections">
          {/* Completion is about what candidates and recruiters show others,
              so admins don't get a bar. */}
          {profile.role !== "admin" && (
            <div className={styles.progress}>
              <div className={styles.progressLabel}>
                <span>Profile complete</span>
                <span>{profile.profileCompletion}%</span>
              </div>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-valuenow={profile.profileCompletion}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Profile complete"
              >
                <div className={styles.progressFill} style={{ width: `${profile.profileCompletion}%` }} />
              </div>
            </div>
          )}

          <ul className={styles.navList}>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className={styles.navLink}>
                  {section.label}
                </a>
              </li>
            ))}
            <li>
              <a href="#delete-account" className={`${styles.navLink} ${styles.navDanger}`}>
                Delete account
              </a>
            </li>
          </ul>
        </nav>

        <div className={styles.content}>
          {/* ---------- 1. The main form: saved with "Save changes" ---------- */}
          <form onSubmit={handleSubmit} className="edit-profile-form" noValidate>
            <BasicInfoSection
              {...sectionProps}
              showOpenToWork={isCandidate}
              ai={isCandidate ? aiWriter : undefined}
            />
            <AboutSection
              {...sectionProps}
              ai={isCandidate ? aiWriter : undefined}
              forRecruiter={profile.role === "recruiter"}
            />

            {isCandidate && (
              <>
                <SocialLinksSection {...sectionProps} />
                <ResumeSection
                  content={content}
                  currentCvUrl={profile.cvUrl ? backendUrl(profile.cvUrl) : ""}
                  cvFile={cvFile}
                  setCvFile={setCvFile}
                />
              </>
            )}

            {profile.role === "recruiter" && (
              <>
                <CompanyInformationSection {...sectionProps} setListField={setListField} />
                <HiringSection {...sectionProps} setListField={setListField} />
              </>
            )}

            {profile.role === "admin" && (
              <section id="admin" className="form-section">
                <div className="form-section-header">
                  <h2>Platform role</h2>
                  <p>This information appears in admin-related areas.</p>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-adminTitle">{content.adminTitle || "Admin title"}</label>
                  <input
                    id="edit-adminTitle"
                    type="text"
                    name="adminTitle"
                    value={formData.adminTitle}
                    onChange={handleChange}
                    placeholder={content.adminTitlePlaceholder || "Platform admin"}
                  />
                </div>
              </section>
            )}

            {error && <Notice tone="error">{error}</Notice>}

            <div className={styles.saveBar}>
              <span className={styles.saveText}>Changes above are saved when you press Save.</span>
              <div className={styles.saveActions}>
                <Link href={ROUTES.PROFILE} className="btn-secondary">
                  {content.cancel || "Cancel"}
                </Link>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? content.saving || "Saving..." : content.saveChanges || "Save changes"}
                </button>
              </div>
            </div>
          </form>

          {/* ---------- 2. Lists: each change saves straight away ---------- */}
          {isCandidate && (
            <>
              <p className={styles.groupLabel}>
                Skills, projects and experience save as soon as you add, edit or remove them.
              </p>
              <SkillsSection content={content} onProfileChange={refreshProfileSummary} />
              <ProjectsSection onProfileChange={refreshProfileSummary} />
              <ExperienceSection onProfileChange={refreshProfileSummary} />
            </>
          )}

          {/* ---------- 3. Danger zone: outside every form on purpose ---------- */}
          <DeleteAccountSection />
        </div>
      </div>
    </Page>
  );
}
