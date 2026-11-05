"use client";

/**
 * Sign-up page.
 *
 * Candidates must add a LinkedIn link and a CV (PDF).
 * Recruiters must add a company name.
 * (Django checks the same rules again, because a browser can be tricked.)
 *
 * After sign-up we go to /verify-email, where the user types the emailed code.
 */

import AuthShell from "../AuthShell";
import { useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { getApiMessage, readJson } from "../../api/client";
import { APP_CONFIG } from "../../config/app";
import {
  CV_MIME_TYPE,
  MAX_CV_FILE_SIZE_MB,
  MIN_PASSWORD_LENGTH,
  USER_ROLES,
} from "../../config/constants";
import { MESSAGES } from "../../config/messages";
import { ROUTES } from "../../config/routes";
import { useUiContent } from "../../hooks/useUiContent";
import { signupUser } from "../../services/authService";
import { checkCvFile } from "../../utils/cvFile";

// Every text box on the form. The names match what Django expects.
const EMPTY_FORM = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: USER_ROLES.CANDIDATE as string,
  linkedinUrl: "",
  companyName: "",
  companyWebsite: "",
  companyLocation: "",
  hiringTitle: "",
};

type FormFields = typeof EMPTY_FORM;

/** Check the form before sending it. Returns an error message, or "". */
function checkForm(form: FormFields, cvFile: File | null): string {
  if (!form.fullName.trim() || !form.email.trim()) {
    return MESSAGES.AUTH.MISSING_NAME_OR_EMAIL;
  }
  if (form.password.length < MIN_PASSWORD_LENGTH) {
    return MESSAGES.AUTH.PASSWORD_TOO_SHORT;
  }
  if (form.password !== form.confirmPassword) {
    return MESSAGES.AUTH.PASSWORDS_DO_NOT_MATCH;
  }
  if (form.role === USER_ROLES.CANDIDATE) {
    if (!form.linkedinUrl.trim()) return MESSAGES.AUTH.LINKEDIN_REQUIRED;
    if (!cvFile) return MESSAGES.AUTH.CV_REQUIRED;
  } else if (!form.companyName.trim()) {
    return MESSAGES.AUTH.COMPANY_REQUIRED;
  }
  return "";
}

export default function SignUpPage() {
  const router = useRouter();
  const text = useUiContent();

  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isCandidate = form.role === USER_ROLES.CANDIDATE;

  // One handler for every text box: the box's "name" says which field to update.
  // (So each input's name MUST be spelled exactly like the field above.)
  function handleInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function chooseCvFile(file: File) {
    const problem = checkCvFile(file);
    setError(problem);
    setCvFile(problem ? null : file);
  }

  function handleCvDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) chooseCvFile(droppedFile);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return; // no double sign-ups

    const problem = checkForm(form, cvFile);
    setError(problem);
    if (problem) return;

    setLoading(true);

    try {
      // FormData (not JSON), because it can carry the CV file.
      const data = new FormData();
      data.append("fullName", form.fullName.trim());
      data.append("email", form.email.trim());
      data.append("password", form.password);
      data.append("role", form.role);

      if (isCandidate) {
        data.append("linkedinUrl", form.linkedinUrl.trim());
        if (cvFile) data.append("cvFile", cvFile);
      } else {
        data.append("companyName", form.companyName.trim());
        data.append("companyWebsite", form.companyWebsite.trim());
        data.append("companyLocation", form.companyLocation.trim());
        data.append("hiringTitle", form.hiringTitle.trim());
      }

      const response = await signupUser(data);

      if (!response.ok) {
        const answer = await readJson(response);
        setError(getApiMessage(answer) || MESSAGES.AUTH.SIGNUP_FAILED);
        return;
      }

      const params = new URLSearchParams({ email: form.email.trim() });
      router.replace(`${ROUTES.VERIFY_EMAIL}?${params.toString()}`);
    } catch (err) {
      console.error("Sign-up error:", err);
      setError(MESSAGES.COMMON.SERVER_UNREACHABLE);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={text("createAccountTitle", "Create account")}
      subtitle={text(
              "createAccountDescription",
              `Join ${APP_CONFIG.NAME} and build your professional profile.`
            )}
    >

        <form className="auth-clean-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="fullName">
              {text("fullName", "Full name")} <span className="required-star">*</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={form.fullName}
              onChange={handleInputChange}
              placeholder={text("fullNamePlaceholder", "Enter your full name")}
              autoComplete="name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              {text("email", "Email")} <span className="required-star">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleInputChange}
              placeholder={text("emailPlaceholder", "Enter your email address")}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              {text("password", "Password")} <span className="required-star">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleInputChange}
              placeholder={text(
                "passwordPlaceholder",
                `At least ${MIN_PASSWORD_LENGTH} characters`
              )}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              {text("confirmPassword", "Confirm password")}{" "}
              <span className="required-star">*</span>
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleInputChange}
              placeholder={text("confirmPasswordPlaceholder", "Type it again")}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">
              {text("role", "Role")} <span className="required-star">*</span>
            </label>
            <select id="role" name="role" value={form.role} onChange={handleInputChange}>
              <option value={USER_ROLES.CANDIDATE}>{text("candidate", "Candidate")}</option>
              <option value={USER_ROLES.RECRUITER}>{text("recruiter", "Recruiter")}</option>
            </select>
          </div>

          {isCandidate ? (
            <>
              <div className="form-group">
                <label htmlFor="linkedinUrl">
                  {text("linkedinProfile", "LinkedIn profile")}{" "}
                  <span className="required-star">*</span>
                </label>
                <input
                  id="linkedinUrl"
                  name="linkedinUrl"
                  type="url"
                  value={form.linkedinUrl}
                  onChange={handleInputChange}
                  placeholder={text(
                    "linkedinProfilePlaceholder",
                    "https://linkedin.com/in/your-profile"
                  )}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="cvFile">
                  {text("uploadCv", "Upload CV")} <span className="required-star">*</span>
                </label>

                <div
                  className="file-upload-box"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleCvDrop}
                >
                  <input
                    id="cvFile"
                    type="file"
                    accept={CV_MIME_TYPE}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) chooseCvFile(file);
                    }}
                  />

                  <p className="file-upload-title">
                    {text("cvUploadTitle", "Upload your CV")}
                  </p>
                  <p className="text-xs muted mt-1">
                    {text("cvUploadHint", `PDF only, maximum ${MAX_CV_FILE_SIZE_MB}MB.`)}
                  </p>

                  {cvFile && (
                    <p className="text-sm mt-1 success-text">
                      {text("selectedFileLabel", "Selected file")}: {cvFile.name}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="role-specific-form">
              <div className="form-group">
                <label htmlFor="companyName">
                  {text("companyName", "Company name")}{" "}
                  <span className="required-star">*</span>
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  value={form.companyName}
                  onChange={handleInputChange}
                  placeholder={text("companyNamePlaceholder", "Enter company name")}
                  autoComplete="organization"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="companyWebsite">
                  {text("companyWebsite", "Company website")}
                </label>
                <input
                  id="companyWebsite"
                  name="companyWebsite"
                  type="url"
                  value={form.companyWebsite}
                  onChange={handleInputChange}
                  placeholder={text("companyWebsitePlaceholder", "https://company.com")}
                />
              </div>

              <div className="form-group">
                <label htmlFor="companyLocation">
                  {text("companyLocation", "Company location")}
                </label>
                <input
                  id="companyLocation"
                  name="companyLocation"
                  type="text"
                  value={form.companyLocation}
                  onChange={handleInputChange}
                  placeholder={text("companyLocationPlaceholder", "Enter company location")}
                />
              </div>

              <div className="form-group">
                <label htmlFor="hiringTitle">{text("hiringTitle", "Hiring title")}</label>
                <input
                  id="hiringTitle"
                  name="hiringTitle"
                  type="text"
                  value={form.hiringTitle}
                  onChange={handleInputChange}
                  placeholder={text("hiringTitlePlaceholder", "Your job title")}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="form-error mb-2" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading
              ? text("creatingAccountButton", "Creating account...")
              : text("createAccountButton", "Create account")}
          </button>

          <p className="text-xs muted text-center mt-2">
            {text("alreadyHaveAccount", "Already have an account?")}{" "}
            <Link href={ROUTES.SIGNIN}>{text("signIn", "Sign in")}</Link>
          </p>
        </form>
    </AuthShell>
  );
}
