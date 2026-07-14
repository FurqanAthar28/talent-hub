"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { apiFetch } from "../../api/client";
import {
  fetchUiContent,
  getUiContentErrorMessage,
  type UiContent,
} from "../../api/ui-content";
import { API_ROUTES } from "../../config/apiRoutes";
import { ROUTES } from "../../config/routes";

function getText(content: UiContent, key: keyof UiContent, fallback: string) {
  const value = content[key];

  if (!value || value === key || value === `/${key}`) {
    return fallback;
  }

  return value;
}

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
        setError(getUiContentErrorMessage(error));
        setUiContent({});
      }
    }

    loadUiContent();
  }, []);

  async function handleSubmit() {
    setError("");

    if (!formData.email.trim() || !formData.password) {
      setError(
        getText(
          uiContent,
          "signinMissingFields",
          "Please enter your email and password."
        )
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
        setError(
          data.message ||
            data.error ||
            getText(uiContent, "signinFailed", "Sign in failed. Please try again.")
        );
        return;
      }

      router.replace(ROUTES.DASHBOARD);
    } catch (err) {
      console.error("Signin error:", err);
      setError(
        getText(uiContent, "serverConnectionError", "Unable to connect to server.")
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;

    setFormData((previousFormData) => ({
      ...previousFormData,
      [name]: value,
    }));
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <Link href={ROUTES.HOME} className="auth-logo">
            {getText(uiContent, "appName", "ProfessionalHub")}
          </Link>

          <h1>{getText(uiContent, "signinWelcome", "Welcome back")}</h1>

          <p>
            {getText(
              uiContent,
              "signinIntro",
              "Sign in to continue to your professional network."
            )}
          </p>
        </div>

        <div className="auth-clean-form">
          <div className="form-group">
            <label htmlFor="email">{getText(uiContent, "email", "Email")}</label>

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
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              {getText(uiContent, "password", "Password")}
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
                "Enter your password"
              )}
              autoComplete="current-password"
            />
          </div>

          <p className="text-xs text-right mb-2">
            <Link href={ROUTES.FORGOT_PASSWORD}>
              {getText(uiContent, "forgotPassword", "Forgot password?")}
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
              ? getText(uiContent, "signingIn", "Signing in...")
              : getText(uiContent, "signin", "Sign in")}
          </button>

          <p className="text-xs muted text-center mt-2">
            {getText(uiContent, "newToApp", "New to ProfessionalHub?")}{" "}
            <Link href={ROUTES.SIGNUP}>
              {getText(uiContent, "createAccount", "Create account")}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
