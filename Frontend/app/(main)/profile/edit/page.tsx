"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "../../../api/client";
import { fetchUiContent, type UiContent } from "../../../api/ui-content";
import { API_ROUTES } from "../../../config/apiRoutes";
import { ROUTES } from "../../../config/routes";
import { buildMediaUrl } from "../../../utils/media";

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
      return data.message || content.genericError || "";
    } catch {
      return content.genericError || "";
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
      setError(content.genericError || "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
      setError(content.genericError || "");
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
      setError(content.genericError || "");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="app-main">
        <div className="container">{content.loading}</div>
      </div>
    );
  }

  const currentCvUrl = currentProfile?.cvUrl
    ? buildMediaUrl(uiContent.apiMediaPrefix, currentProfile.cvUrl)
    : "";

  return (
    <div className="app-main">
      <div className="container">
        <div className="edit-profile-card">
          <div className="edit-profile-header">
            <h1>{content.editProfileTitle}</h1>
            <p>{content.editProfileDescription}</p>
          </div>

          <form onSubmit={handleSubmit} className="edit-profile-form">
            <div className="form-group">
              <label>{content.fullName}</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder={content.fullNamePlaceholder}
              />
            </div>

            <div className="form-group">
              <label>{content.headline}</label>
              <input
                type="text"
                name="headline"
                value={formData.headline}
                onChange={handleChange}
                placeholder={content.headlinePlaceholder}
              />
            </div>

            <div className="form-group">
              <label>{content.location}</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder={content.locationPlaceholder}
              />
            </div>

            <div className="form-group">
              <label>{content.bio}</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder={content.bioPlaceholder}
                rows={5}
              />
            </div>

            {currentProfile?.role === "candidate" && (
              <>
                <div className="form-group">
                  <label>{content.linkedinUrl}</label>
                  <input
                    type="text"
                    name="linkedinUrl"
                    value={formData.linkedinUrl}
                    onChange={handleChange}
                    placeholder={content.linkedinUrlPlaceholder}
                  />
                </div>

                <div className="form-group">
                  <label>{content.githubUrl}</label>
                  <input
                    type="text"
                    name="githubUrl"
                    value={formData.githubUrl}
                    onChange={handleChange}
                    placeholder={content.githubUrlPlaceholder}
                  />
                </div>

                <div className="form-group">
                  <label>{content.portfolioUrl}</label>
                  <input
                    type="text"
                    name="portfolioUrl"
                    value={formData.portfolioUrl}
                    onChange={handleChange}
                    placeholder={content.portfolioUrlPlaceholder}
                  />
                </div>
              </>
            )}

            {currentProfile?.role === "recruiter" && (
              <div className="role-specific-form">
                <div className="form-group">
                  <label>{content.companyName}</label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    placeholder={content.companyNamePlaceholder}
                  />
                </div>

                <div className="form-group">
                  <label>{content.companyWebsite}</label>
                  <input
                    type="url"
                    name="companyWebsite"
                    value={formData.companyWebsite}
                    onChange={handleChange}
                    placeholder={content.companyWebsitePlaceholder}
                  />
                </div>

                <div className="form-group">
                  <label>{content.companyLocation}</label>
                  <input
                    type="text"
                    name="companyLocation"
                    value={formData.companyLocation}
                    onChange={handleChange}
                    placeholder={content.companyLocationPlaceholder}
                  />
                </div>

                <div className="form-group">
                  <label>{content.hiringTitle}</label>
                  <input
                    type="text"
                    name="hiringTitle"
                    value={formData.hiringTitle}
                    onChange={handleChange}
                    placeholder={content.hiringTitlePlaceholder}
                  />
                </div>
              </div>
            )}

            {currentProfile?.role === "admin" && (
              <div className="form-group">
                <label>{content.adminTitle}</label>
                <input
                  type="text"
                  name="adminTitle"
                  value={formData.adminTitle}
                  onChange={handleChange}
                  placeholder={content.adminTitlePlaceholder}
                />
              </div>
            )}

            {currentProfile?.role === "candidate" && (
              <div className="form-group">
                <label>{content.cvResume}</label>

                {currentProfile?.cvUrl && (
                  <a
                    href={currentCvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-link"
                  >
                    {content.viewCurrentCv}
                  </a>
                )}

                <div className="file-upload-box">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(event) =>
                      setCvFile(event.target.files?.[0] || null)
                    }
                  />

                  <p className="file-upload-title">
                    {content.cvReplaceTitle}
                  </p>

                  <p className="text-xs muted mt-1">
                    {content.cvUploadHint}
                  </p>

                  {cvFile && (
                    <p className="text-sm mt-1 success-text">
                      {content.selectedFileLabel}: {cvFile.name}
                    </p>
                  )}
                </div>
              </div>
            )}

            {error && <div className="form-error">{error}</div>}

            <div className="edit-profile-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => router.push(content.routeProfile || ROUTES.PROFILE)}
              >
                {content.cancel}
              </button>

              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? content.saving : content.saveChanges}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
