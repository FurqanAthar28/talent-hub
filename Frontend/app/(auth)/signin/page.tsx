"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { apiFetch } from "../../api/client";
import { fetchUiContent, type UiContent } from "../../api/ui-content";
import { API_ROUTES } from "../../config/apiRoutes";
import { ROUTES } from "../../config/routes";

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
      const data = await fetchUiContent();
      setUiContent(data);
    }

    loadUiContent();
  }, []);

  async function handleSubmit() {
    setError("");

    if (!formData.email.trim() || !formData.password) {
      setError(
        uiContent.signinMissingFields || "Please enter your email and password."
      );
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch(
        API_ROUTES.ACCOUNTS.SIGNIN,
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
          router.replace(
            `${uiContent.routeVerifyEmail || "/verify-email"}?${params.toString()}`
          );
          return;
        }

        setError(
          data.message ||
            data.error ||
            uiContent.signinFailed ||
            "Sign in failed. Please try again."
        );
        return;
      }

      router.replace(uiContent.routeDashboard || ROUTES.DASHBOARD);
    } catch (err) {
      console.error("Signin error:", err);
      setError(
        uiContent.serverConnectionError || "Unable to connect to server."
      );
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

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <Link href="/" className="auth-logo">
            {uiContent.appName || "ProfessionalHub"}
          </Link>

          <h1>{uiContent.signinWelcome || "Welcome back"}</h1>

          <p>{uiContent.signinIntro || "Sign in to continue."}</p>
        </div>

        <div className="auth-clean-form">
          <div className="form-group">
            <label htmlFor="email">{uiContent.email || "Email"}</label>

            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={uiContent.emailPlaceholder || "Enter your email"}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              {uiContent.password || "Password"}
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={uiContent.passwordPlaceholder || "Enter your password"}
              autoComplete="current-password"
            />
          </div>

          <p className="text-xs text-right mb-2">
            <Link href={uiContent.routeForgotPassword || ROUTES.FORGOT_PASSWORD}>
              {uiContent.forgotPassword || "Forgot password?"}
            </Link>
          </p>

          {error && <div className="form-error mb-2">{error}</div>}

          <button
            type="button"
            className="btn-primary btn-full"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading
              ? uiContent.signingIn || "Signing in..."
              : uiContent.signin || "Sign in"}
          </button>

          <p className="text-xs muted text-center mt-2">
            {uiContent.newToApp || "New to ProfessionalHub?"}{" "}
            <Link href={uiContent.routeSignup || ROUTES.SIGNUP}>
              {uiContent.createAccount || "Create account"}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}