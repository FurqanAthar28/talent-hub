"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "../../../api/client";
import { fetchUiContent, type UiContent } from "../../../api/ui-content";
import { API_ROUTES } from "../../../config/apiRoutes";
import { ROUTES } from "../../../config/routes";
import { buildMediaUrl } from "../../../utils/media";
import BasicInfoSection from "./components/BasicInfoSection";
import AboutSection from "./components/AboutSection";
import SocialLinksSection from "./components/SocialLinksSection";
import ResumeSection from "./components/ResumeSection";
import SkillsSection from "./components/SkillsSection";
import ProjectsSection from "./components/projects/ProjectsSection";
import ExperienceSection from "./components/experience/ExperienceSection";

type Profile = {
  role: "candidate" | "recruiter" | "admin";
  fullName: string;
  email: string;
  headline?: string;
  location?: string;
  bio?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  companyName?: string;
  companyWebsite?: string;
  companyLocation?: string;
  hiringTitle?: string;
  adminTitle?: string;
  cvUrl?: string;
  profileCompletion?: number;
  profileViewers?: number;
  openToWork?: boolean;
};

type ApiErrorResponse = {
  message?: string;
  errors?: Record<string, unknown>;
};

export default function EditProfilePage() {
  const router = useRouter();

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [uiContent, setUiContent] = useState<UiContent>({});

  const content = uiContent as Record<string, string | undefined>;

  const [formData, setFormData] = useState({
    fullName: "",
    headline: "",
    location: "",
    bio: "",
    linkedinUrl: "",
    githubUrl: "",
    portfolioUrl: "",
    companyName: "",
    companyWebsite: "",
    companyLocation: "",
    hiringTitle: "",
    adminTitle: "",
  });

  async function getErrorMessage(response: Response) {
    try {
      const data = (await response.json()) as ApiErrorResponse;
      return data.message || content.genericError || "Something went wrong.";
    } catch {
      return content.genericError || "Something went wrong.";
    }
  }

  async function loadProfile() {
    setError("");

    try {
      const uiContentData = await fetchUiContent();
      setUiContent(uiContentData);

      const res = await apiFetch(API_ROUTES.PROFILES.ME);

      if (!res.ok) {
        const message = await getErrorMessage(res);
        setError(message);
        return;
      }

      const profile = await res.json();
      setCurrentProfile(profile);

      setFormData({
        fullName: profile.fullName || "",
        headline: profile.headline || "",
        location: profile.location || "",
        bio: profile.bio || "",
        linkedinUrl: profile.linkedinUrl || "",
        githubUrl: profile.githubUrl || "",
        portfolioUrl: profile.portfolioUrl || "",
        companyName: profile.companyName || "",
        companyWebsite: profile.companyWebsite || "",
        companyLocation: profile.companyLocation || "",
        hiringTitle: profile.hiringTitle || "",
        adminTitle: profile.adminTitle || "",
      });
    } catch {
      setError(content.genericError || "Unable to load profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    function scrollToHash() {
      const hash = window.location.hash;

      if (!hash) return;

      const targetElement = document.querySelector(hash);

      if (!targetElement) return;

      setTimeout(() => {
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }

    if (!loading) {
      scrollToHash();
    }

    window.addEventListener("hashchange", scrollToHash);

    return () => {
      window.removeEventListener("hashchange", scrollToHash);
    };
  }, [loading]);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!currentProfile) {
      setError(content.genericError || "Unable to update profile.");
      return;
    }

    setSaving(true);

    try {
      const profileData = new FormData();

      profileData.append("fullName", formData.fullName.trim());
      profileData.append("headline", formData.headline);
      profileData.append("location", formData.location);
      profileData.append("bio", formData.bio);

      if (currentProfile.role === "candidate") {
        profileData.append("linkedinUrl", formData.linkedinUrl);
        profileData.append("githubUrl", formData.githubUrl);
        profileData.append("portfolioUrl", formData.portfolioUrl);

        if (cvFile) {
          profileData.append("cvFile", cvFile);
        }
      }

      if (currentProfile.role === "recruiter") {
        profileData.append("companyName", formData.companyName);
        profileData.append("companyWebsite", formData.companyWebsite);
        profileData.append("companyLocation", formData.companyLocation);
        profileData.append("hiringTitle", formData.hiringTitle);
      }

      if (currentProfile.role === "admin") {
        profileData.append("adminTitle", formData.adminTitle);
      }

      const res = await apiFetch(API_ROUTES.PROFILES.UPDATE_ME, {
        method: "PATCH",
        body: profileData,
      });

      if (!res.ok) {
        const message = await getErrorMessage(res);
        setError(message);
        return;
      }

      router.push(content.routeProfile || ROUTES.PROFILE);
    } catch {
      setError(content.genericError || "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="page-shell">
        <section className="dashboard-section">
          <p>{content.loading || "Loading profile..."}</p>
        </section>
      </main>
    );
  }

  const currentCvUrl = currentProfile?.cvUrl
    ? buildMediaUrl(uiContent.apiMediaPrefix, currentProfile.cvUrl)
    : "";

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="eyebrow">Profile Editor</p>
        <h1>{content.editProfileTitle || "Edit Profile"}</h1>
        <p>
          {content.editProfileDescription ||
            "Keep your professional information complete and up to date."}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="edit-profile-form">
        <BasicInfoSection
          content={content}
          formData={formData}
          handleChange={handleChange}
        />

        <AboutSection
          content={content}
          formData={formData}
          handleChange={handleChange}
        />

        {currentProfile?.role === "candidate" && (
          <SocialLinksSection
            content={content}
            formData={formData}
            handleChange={handleChange}
          />
        )}

        {currentProfile?.role === "candidate" && (
          <ResumeSection
            content={content}
            currentCvUrl={currentCvUrl}
            cvFile={cvFile}
            setCvFile={setCvFile}
          />
        )}

        {currentProfile?.role === "candidate" && (
          <SkillsSection content={content} />
        )}

        {currentProfile?.role === "candidate" && <ProjectsSection />}

        {currentProfile?.role === "candidate" && <ExperienceSection />}

        {currentProfile?.role === "recruiter" && (
          <section id="company" className="form-section">
            <div className="form-section-header">
              <p className="eyebrow">Recruiter Profile</p>
              <h2>Company Information</h2>
              <p>Help candidates understand your company and hiring needs.</p>
            </div>

            <div className="form-group">
              <label>{content.companyName || "Company Name"}</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder={content.companyNamePlaceholder || "Company name"}
              />
            </div>

            <div className="form-group">
              <label>{content.companyWebsite || "Company Website"}</label>
              <input
                type="url"
                name="companyWebsite"
                value={formData.companyWebsite}
                onChange={handleChange}
                placeholder={
                  content.companyWebsitePlaceholder || "https://company.com"
                }
              />
            </div>

            <div className="form-group">
              <label>{content.companyLocation || "Company Location"}</label>
              <input
                type="text"
                name="companyLocation"
                value={formData.companyLocation}
                onChange={handleChange}
                placeholder={
                  content.companyLocationPlaceholder || "City, Country"
                }
              />
            </div>

            <div className="form-group">
              <label>{content.hiringTitle || "Hiring Title"}</label>
              <input
                type="text"
                name="hiringTitle"
                value={formData.hiringTitle}
                onChange={handleChange}
                placeholder={
                  content.hiringTitlePlaceholder || "Technical Recruiter"
                }
              />
            </div>
          </section>
        )}

        {currentProfile?.role === "admin" && (
          <section id="admin" className="form-section">
            <div className="form-section-header">
              <p className="eyebrow">Admin Profile</p>
              <h2>Platform Role</h2>
              <p>This information appears in admin-related areas.</p>
            </div>

            <div className="form-group">
              <label>{content.adminTitle || "Admin Title"}</label>
              <input
                type="text"
                name="adminTitle"
                value={formData.adminTitle}
                onChange={handleChange}
                placeholder={content.adminTitlePlaceholder || "Platform Admin"}
              />
            </div>
          </section>
        )}

        {error && <div className="form-error">{error}</div>}

        <div className="edit-profile-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push(content.routeProfile || ROUTES.PROFILE)}
          >
            {content.cancel || "Cancel"}
          </button>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? content.saving || "Saving..."
              : content.saveChanges || "Save Changes"}
          </button>
        </div>
      </form>
    </main>
  );
}