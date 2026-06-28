"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { apiFetch } from "../../api/client";
import { fetchUiContent, type UiContent } from "../../api/ui-content";

export default function SignInPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uiContent, setUiContent] = useState<UiContent>({});

  useEffect(() => {
    async function loadUiContent() {
      try {
        const data = await fetchUiContent();
        setUiContent(data);
      } catch (error) {
        console.error("Failed to load signin UI content:", error);
        setError(error instanceof Error ? error.message : "");
      }
    }

    loadUiContent();
  }, []);

  async function handleSubmit() {
    setError("");

    if (!formData.email.trim() || !formData.password) {
      setError(uiContent.signinMissingFields);
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch(
        uiContent.apiSignin,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        },
        { redirectOnUnauthorized: false }
      );

      const data = await res.json();

      if (!res.ok) {
        if (data.message === uiContent.emailVerificationRequired) {
          const params = new URLSearchParams({ email: formData.email });
          router.replace(`${uiContent.routeVerifyEmail}?${params.toString()}`);
          return;
        }

        setError(data.message || data.error || uiContent.signinFailed);
        return;
      }

      router.replace(uiContent.routeDashboard);
    } catch (err) {
      console.error("Signin error:", err);
      setError(uiContent.serverConnectionError);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;

    setFormData((previousFormData) => ({
      ...previousFormData,
      [name]: value,
    }));
  }

  if (!uiContent.signin) return null;

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <Link href="/" className="auth-logo">
            {uiContent.appName}
          </Link>

          <h1>{uiContent.signinWelcome}</h1>

          <p>{uiContent.signinIntro}</p>
        </div>

        <div className="auth-clean-form">
          <div className="form-group">
            <label htmlFor="email">{uiContent.email}</label>

            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={uiContent.emailPlaceholder}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{uiContent.password}</label>

            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={uiContent.passwordPlaceholder}
              autoComplete="current-password"
            />
          </div>

          {uiContent.forgotPassword && (
            <p className="text-xs text-right mb-2">
              <Link href={uiContent.routeForgotPassword}>
                {uiContent.forgotPassword}
              </Link>
            </p>
          )}

          {error && <div className="form-error mb-2">{error}</div>}

          <button
            type="button"
            className="btn-primary btn-full"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? uiContent.signingIn : uiContent.signin}
          </button>

          <p className="text-xs muted text-center mt-2">
            {uiContent.newToApp}{" "}
            <Link href={uiContent.routeSignup}>{uiContent.createAccount}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
