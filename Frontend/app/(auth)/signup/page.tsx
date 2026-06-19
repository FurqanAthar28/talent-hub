"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../api/client";

export default function SignUpPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    linkedinUrl: "",
  });

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleCvDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setCvFile(droppedFile);
    }
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
      setError("Passwords do not match");
      return;
    }

    if (!cvFile) {
      setError("CV file is required");
      return;
    }

    if (cvFile.type !== "application/pdf") {
      setError("Only PDF files are accepted");
      return;
    }

    if (cvFile.size > 5 * 1024 * 1024) {
      setError("CV file must be less than 5MB");
      return;
    }

    if (!formData.linkedinUrl.includes("linkedin.com")) {
      setError("Please enter a valid LinkedIn URL");
      return;
    }

    setLoading(true);

    try {
      const data = new FormData();
      data.append("fullName", formData.fullName);
      data.append("email", formData.email);
      data.append("password", formData.password);
      data.append("linkedinUrl", formData.linkedinUrl);
      data.append("cvFile", cvFile);

      const res = await apiFetch("/accounts/signup", {
        method: "POST",
        body: data,
      });

      const result = await res.json();

      if (!res.ok) {
        setError(
          result.email?.[0] ||
            result.fullName?.[0] ||
            result.linkedinUrl?.[0] ||
            result.cvFile?.[0] ||
            result.password?.[0] ||
            result.message ||
            result.error ||
            "Signup failed"
        );
        return;
      }

      router.replace("/signin");
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <Link href="/" className="auth-logo">
            ProfessionalHub
          </Link>

          <h1>Create your account</h1>

          <p>
            Build your professional profile, connect with professionals, and
            showcase your work.
          </p>
        </div>

        <div className="auth-clean-form">
          <div className="form-group">
            <label htmlFor="fullName">
              Full Name <span className="required-star">*</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              Email <span className="required-star">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="john.doe@company.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password <span className="required-star">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Enter your password"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              Confirm Password <span className="required-star">*</span>
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="linkedinUrl">
              LinkedIn Profile <span className="required-star">*</span>
            </label>
            <input
              id="linkedinUrl"
              name="linkedinUrl"
              type="url"
              value={formData.linkedinUrl}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="https://linkedin.com/in/username"
              required
            />
          </div>

          <div className="form-group">
            <label>
              Upload CV/Resume <span className="required-star">*</span>
            </label>
            <div
              className="file-upload-box"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleCvDrop}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setCvFile(e.target.files?.[0] || null)}
              />
              <p className="file-upload-title">
                Drag and drop your PDF here, or choose a file
              </p>
              <p className="text-xs muted mt-1">PDF only. Max 5MB.</p>
              {cvFile && (
                <p className="text-sm mt-1 success-text">
                  Selected: {cvFile.name}
                </p>
              )}
            </div>
          </div>

          {error && <div className="form-error mb-2">{error}</div>}

          <button
            type="button"
            className="btn-primary btn-full"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p className="text-xs muted text-center mt-2">
            Already have an account? <Link href="/signin">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}