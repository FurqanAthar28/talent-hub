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
import {
  fetchUiContent,
  getUiContentErrorMessage,
  type UiContent,
} from "../../api/ui-content";
import { MESSAGES } from "../../config/messages";
import { ROUTES } from "../../config/routes";

function getText(
  content: UiContent,
  key: keyof UiContent,
  fallback: string
): string {
  const value = content[key];

  if (!value || value === key) {
    return fallback;
  }

  return value;
}

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
        setError(getUiContentErrorMessage(error));
        setUiContent({});
      }
    }

    loadUiContent();
  }, []);

  function handleInputChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setFormData((previousData) => ({ ...previousData, [name]: value }));
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

  function handleCvDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const droppedFile = event.dataTransfer.files[0];

    if (droppedFile) {
      handleCvFileSelect(droppedFile);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
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

      router.replace(
        `${getText(
          uiContent,
          "routeVerifyEmail",
          "/verify-email"
        )}?${params.toString()}`
      );
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
          <Link href={ROUTES.HOME} className="auth-logo">
            {APP_CONFIG.NAME}
          </Link>

          <h1>{getText(uiContent, "createAccountTitle", "Create account")}</h1>

          <p>
            {getText(
              uiContent,
              "createAccountDescription",
              "Join ProfessionalHub and build your professional profile."
            )}
          </p>
        </div>

        <div className="auth-clean-form">
          <div className="form-group">
            <label htmlFor="fullName">
              {getText(uiContent, "fullName", "Full name")}{" "}
              <span className="required-star">*</span>
            </label>

            <input
              id="fullName"
              name="FullName"
              type="text"
              value={formData.fullName}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={getText(
                uiContent,
                "fullNamePlaceholder",
                "Enter your full name"
              )}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              {getText(uiContent, "email", "Email")}{" "}
              <span className="required-star">*</span>
            </label>

            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={getText(
                uiContent,
                "emailPlaceholder",
                "Enter your email address"
              )}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              {getText(uiContent, "password", "Password")}{" "}
              <span className="required-star">*</span>
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={getText(
                uiContent,
                "passwordPlaceholder",
                "Create a password"
              )}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              {getText(uiContent, "confirmPassword", "Confirm password")}{" "}
              <span className="required-star">*</span>
            </label>

            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={getText(
                uiContent,
                "confirmPasswordPlaceholder",
                "Confirm your password"
              )}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">
              {getText(uiContent, "role", "Role")}{" "}
              <span className="required-star">*</span>
            </label>

            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              required
            >
              <option value={USER_ROLES.CANDIDATE}>
                {getText(uiContent, "candidate", "Candidate")}
              </option>
              <option value={USER_ROLES.RECRUITER}>
                {getText(uiContent, "recruiter", "Recruiter")}
              </option>
            </select>
          </div>

          {isCandidate && (
            <div className="form-group">
              <label htmlFor="linkedinUrl">
                {getText(uiContent, "linkedinProfile", "LinkedIn profile")}{" "}
                <span className="required-star">*</span>
              </label>

              <input
                id="linkedinUrl"
                name="linkedinUrl"
                type="url"
                value={formData.linkedinUrl}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={getText(
                  uiContent,
                  "linkedinProfilePlaceholder",
                  "https://linkedin.com/in/your-profile"
                )}
                required
              />
            </div>
          )}

          {!isCandidate && (
            <div className="role-specific-form">
              <div className="form-group">
                <label htmlFor="companyName">
                  {getText(uiContent, "companyName", "Company name")}{" "}
                  <span className="required-star">*</span>
                </label>

                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={getText(
                    uiContent,
                    "companyNamePlaceholder",
                    "Enter company name"
                  )}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="companyWebsite">
                  {getText(uiContent, "companyWebsite", "Company website")}
                </label>

                <input
                  id="companyWebsite"
                  name="companyWebsite"
                  type="url"
                  value={formData.companyWebsite}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={getText(
                    uiContent,
                    "companyWebsitePlaceholder",
                    "https://company.com"
                  )}
                />
              </div>

              <div className="form-group">
                <label htmlFor="companyLocation">
                  {getText(uiContent, "companyLocation", "Company location")}
                </label>

                <input
                  id="companyLocation"
                  name="companyLocation"
                  type="text"
                  value={formData.companyLocation}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={getText(
                    uiContent,
                    "companyLocationPlaceholder",
                    "Enter company location"
                  )}
                />
              </div>

              <div className="form-group">
                <label htmlFor="hiringTitle">
                  {getText(uiContent, "hiringTitle", "Hiring title")}
                </label>

                <input
                  id="hiringTitle"
                  name="hiringTitle"
                  type="text"
                  value={formData.hiringTitle}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={getText(
                    uiContent,
                    "hiringTitlePlaceholder",
                    "Your hiring title"
                  )}
                />
              </div>
            </div>
          )}

          {isCandidate && (
            <div className="form-group">
              <label>
                {getText(uiContent, "uploadCv", "Upload CV")}{" "}
                <span className="required-star">*</span>
              </label>

              <div
                className="file-upload-box"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleCvDrop}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (file) {
                      handleCvFileSelect(file);
                    }
                  }}
                />

                <p className="file-upload-title">
                  {getText(uiContent, "cvUploadTitle", "Upload your CV")}
                </p>

                <p className="text-xs muted mt-1">
                  {getText(uiContent, "cvUploadHint", "PDF only, maximum 5MB.")}
                </p>

                {cvFile && (
                  <p className="text-sm mt-1 success-text">
                    {getText(uiContent, "selectedFileLabel", "Selected file")}:{" "}
                    {cvFile.name}
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
              ? getText(uiContent, "creatingAccountButton", "Creating account...")
              : getText(uiContent, "createAccountButton", "Create account")}
          </button>

          <p className="text-xs muted text-center mt-2">
            {getText(uiContent, "alreadyHaveAccount", "Already have an account?")}{" "}
            <Link href={getText(uiContent, "routeSignin", ROUTES.SIGNIN)}>
              {getText(uiContent, "signIn", "Sign in")}
            </Link>
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
