'use client';
import { apiFetch } from "../../../api/client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';



type Profile = {
  fullName: string;
  email: string;
  headline?: string;
  location?: string;
  bio?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  cvUrl?: string;
  profileCompletion?: number;
  profileViewers?: number;
  openToWork?: boolean;
};

export default function EditProfilePage() {
  const router = useRouter();

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    headline: '',
    location: '',
    bio: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
  });

  async function loadProfile() {
   

    try {
      const res = await apiFetch("/profiles/me");


      if (res.ok) {
        const profile = await res.json();
        setCurrentProfile(profile);

        setFormData({
          fullName: profile.fullName || '',
          headline: profile.headline || '',
          location: profile.location || '',
          bio: profile.bio || '',
          linkedinUrl: profile.linkedinUrl || '',
          githubUrl: profile.githubUrl || '',
          portfolioUrl: profile.portfolioUrl || '',
        });
      }
    } catch {
      setError("Something went wrong while loading profile");
    } finally {
      setLoading(false);
    }
  }

useEffect(() => {
  async function loadInitialProfile() {
    await loadProfile();
  }

  loadInitialProfile();
}, [router]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (!formData.fullName.trim()) {
      setError('Full name is required');
      return;
    }

    if (cvFile) {
      if (cvFile.type !== 'application/pdf') {
        setError('Only PDF files are accepted');
        return;
      }

      if (cvFile.size > 5 * 1024 * 1024) {
        setError('CV file must be less than 5MB');
        return;
      }
    }

    if (!currentProfile ) {
      setError('User data not found. Please sign in again.');
      return;
    }

    setSaving(true);

    try {
      const profileData = new FormData();
      profileData.append('fullName', formData.fullName.trim());
      profileData.append('headline', formData.headline);
      profileData.append('location', formData.location);
      profileData.append('bio', formData.bio);
      profileData.append('linkedinUrl', formData.linkedinUrl);
      profileData.append('githubUrl', formData.githubUrl);
      profileData.append('portfolioUrl', formData.portfolioUrl);

      if (cvFile) {
        profileData.append('cvFile', cvFile);
      }

      const res = await apiFetch("/profiles/me/update", {
       method: "PATCH",
       body: profileData,
       });

      const updatedProfile = await res.json();

      if (!res.ok) {
        setError(
          updatedProfile.message || 'Something went wrong while updating profile'
        );
        setSaving(false);
        return;
      }

      router.push('/profile');
    } catch {
      setError('Something went wrong while updating profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="app-main">
        <div className="container">Loading...</div>
      </div>
    );
  }

  const currentCvUrl = currentProfile?.cvUrl
  ? currentProfile.cvUrl.startsWith("http")
    ? currentProfile.cvUrl
    : `/api/backend/media/${currentProfile.cvUrl}`
  : "";

  return (
    <div className="app-main">
      <div className="container">
        <div className="edit-profile-card">
          <div className="edit-profile-header">
            <h1>Edit Profile</h1>
            <p>Update your professional information.</p>
          </div>

          <form onSubmit={handleSubmit} className="edit-profile-form">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Enter your full name"
              />
            </div>

            <div className="form-group">
              <label>Headline</label>
              <input
                type="text"
                name="headline"
                value={formData.headline}
                onChange={handleChange}
                placeholder="Your Position"
              />
            </div>

            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="City,Country"
              />
            </div>

            <div className="form-group">
              <label>Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Write a short professional bio"
                rows={5}
              />
            </div>

            <div className="form-group">
              <label>LinkedIn URL</label>
              <input
                type="text"
                name="linkedinUrl"
                value={formData.linkedinUrl}
                onChange={handleChange}
                placeholder="https://linkedin.com/in/username"
              />
            </div>

            <div className="form-group">
              <label>GitHub URL</label>
              <input
                type="text"
                name="githubUrl"
                value={formData.githubUrl}
                onChange={handleChange}
                placeholder="https://github.com/username"
              />
            </div>

            <div className="form-group">
              <label>Portfolio URL</label>
              <input
                type="text"
                name="portfolioUrl"
                value={formData.portfolioUrl}
                onChange={handleChange}
                placeholder="https://yourportfolio.com"
              />
            </div>

            <div className="form-group">
              <label>CV / Resume</label>

              {currentProfile?.cvUrl && (
                <a
                  href={currentCvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="quick-link"
                >
                  View current CV
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
                  Choose a PDF to upload or replace your CV
                </p>

                <p className="text-xs muted mt-1">PDF only. Max 5MB.</p>

                {cvFile && (
                  <p className="text-sm mt-1 success-text">
                    Selected: {cvFile.name}
                  </p>
                )}
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="edit-profile-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => router.push('/profile')}
              >
                Cancel
              </button>

              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}



