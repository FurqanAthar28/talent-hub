"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { 
  MAX_CV_FILE_SIZE_BYTES,
  CV_MIME_TYPE,
  MIN_PASSWORD_LENGTH,
  USER_ROLES,
} from "../../config/constants";
import { APP_CONFIG } from "../../config/app";
import { signupUser } from "../../services/authService";
import { parseApiError } from "../../utils/parseApiError";
import { fetchUiContent, type UiContent } from "../../api/ui-content";
import { MESSAGES } from "../../config/messages";

function SignUpContent() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: USER_ROLES.CANDIDATE,
    linkedinUrl: "",
    companyName: "",
    companyWebsite: "",
    companyLocation: "",
    hiringTitle: "",
  });

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uiContent, setUiContent] = useState<UiContent>({});

  const isCandidate = formData.role === USER_ROLES.CANDIDATE;

  useEffect(() => {
    async function loadUiContent() {
      try {
        const data = await fetchUiContent();
        setUiContent(data);
      } catch (error) {
        console.error("Failed to load signup UI content:", error);
      }
    }

    loadUiContent();
  }, []);

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleCvFileSelect(file: File) {
    if (file.type !== CV_MIME_TYPE) {
      setError(MESSAGES.AUTH.PDF_ONLY);
      return;
    }

    if (file.size > MAX_CV_FILE_SIZE_BYTES) {
      setError(MESSAGES.AUTH.CV_SIZE_LIMIT);
      return;
    }

    setError("");
    setCvFile(file);
  }

  function handleCvDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleCvFileSelect(droppedFile);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  async function handleSubmit() {
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError(MESSAGES.AUTH.PASSWORDS_DO_NOT_MATCH);
      return;
    }

    setLoading(true);

    try {
      const data = new FormData();

      data.append("fullName", formData.fullName);
      data.append("email", formData.email);
      data.append("password", formData.password);
      data.append("role", formData.role);
      data.append("linkedinUrl", formData.linkedinUrl);
      data.append("companyName", formData.companyName);
      data.append("companyWebsite", formData.companyWebsite);
      data.append("companyLocation", formData.companyLocation);
      data.append("hiringTitle", formData.hiringTitle);

      if (isCandidate && cvFile) {
        data.append("cvFile", cvFile);
      }

      const res = await signupUser(data);
      const result = await res.json();

      if (!res.ok) {
        setError(parseApiError(result));
        return;
      }

      const params = new URLSearchParams({ email: formData.email });
      router.replace(`${uiContent.routeVerifyEmail}?${params.toString()}`);
    } catch (error) {
      console.error("Signup error:", error);
      setError(MESSAGES.COMMON.SOMETHING_WENT_WRONG);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <Link href="/" className="auth-logo">
            {APP_CONFIG.NAME}
          </Link>

          <h1>{uiContent.createAccountTitle}</h1>

          <p>{uiContent.createAccountDescription}</p>
        </div>

        <div className="auth-clean-form">
          <div className="form-group">
            <label htmlFor="fullName">
              {uiContent.fullName} <span className="required-star">*</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={uiContent.fullNamePlaceholder}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              {uiContent.email} <span className="required-star">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={uiContent.emailPlaceholder}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              {uiContent.password} <span className="required-star">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={uiContent.passwordPlaceholder}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              {uiContent.confirmPassword}{" "}
              <span className="required-star">*</span>
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={uiContent.confirmPasswordPlaceholder}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">
              {uiContent.role} <span className="required-star">*</span>
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              required
            >
              <option value={USER_ROLES.CANDIDATE}>{uiContent.candidate}</option>
              <option value={USER_ROLES.RECRUITER}>{uiContent.recruiter}</option>
            </select>
          </div>

          {isCandidate && (
            <div className="form-group">
              <label htmlFor="linkedinUrl">
                {uiContent.linkedinProfile}{" "}
                <span className="required-star">*</span>
              </label>
              <input
                id="linkedinUrl"
                name="linkedinUrl"
                type="url"
                value={formData.linkedinUrl}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={uiContent.linkedinProfilePlaceholder}
                required
              />
            </div>
          )}

          {!isCandidate && (
            <div className="role-specific-form">
              <div className="form-group">
                <label htmlFor="companyName">
                  {uiContent.companyName}{" "}
                  <span className="required-star">*</span>
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={uiContent.companyNamePlaceholder}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="companyWebsite">
                  {uiContent.companyWebsite}
                </label>
                <input
                  id="companyWebsite"
                  name="companyWebsite"
                  type="url"
                  value={formData.companyWebsite}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={uiContent.companyWebsitePlaceholder}
                />
              </div>

              <div className="form-group">
                <label htmlFor="companyLocation">
                  {uiContent.companyLocation}
                </label>
                <input
                  id="companyLocation"
                  name="companyLocation"
                  type="text"
                  value={formData.companyLocation}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={uiContent.companyLocationPlaceholder}
                />
              </div>

              <div className="form-group">
                <label htmlFor="hiringTitle">{uiContent.hiringTitle}</label>
                <input
                  id="hiringTitle"
                  name="hiringTitle"
                  type="text"
                  value={formData.hiringTitle}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={uiContent.hiringTitlePlaceholder}
                />
              </div>
            </div>
          )}

          {isCandidate && (
            <div className="form-group">
              <label>
                {uiContent.uploadCv} <span className="required-star">*</span>
              </label>

              <div
                className="file-upload-box"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleCvDrop}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCvFileSelect(file);
                  }}
                />

                <p className="file-upload-title">{uiContent.cvUploadTitle}</p>

                <p className="text-xs muted mt-1">{uiContent.cvUploadHint}</p>

                {cvFile && (
                  <p className="text-sm mt-1 success-text">
                    {uiContent.selectedFileLabel}: {cvFile.name}
                  </p>
                )}
              </div>
            </div>
          )}

          {error && <div className="form-error mb-2">{error}</div>}

          <button
            type="button"
            className="btn-primary btn-full"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading
              ? uiContent.creatingAccountButton
              : uiContent.createAccountButton}
          </button>

          <p className="text-xs muted text-center mt-2">
            {uiContent.alreadyHaveAccount}{" "}
            <Link href={uiContent.routeSignin || "/signin"}>{uiContent.signIn}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignUpContent />
    </Suspense>
  );
}