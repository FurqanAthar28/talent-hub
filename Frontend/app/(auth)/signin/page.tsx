"use client";

/**
 * Sign-in page.
 *
 * Django checks the password and, if it's right, sets the login cookies.
 * We never see or store the tokens here: the browser keeps them.
 */

import AuthShell from "../AuthShell";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { postJson } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { APP_CONFIG } from "../../config/app";
import { MESSAGES } from "../../config/messages";
import { ROUTES, safeNextPath } from "../../config/routes";
import { useUiContent } from "../../hooks/useUiContent";

export default function SignInPage() {
  const router = useRouter();
  const text = useUiContent();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // A real <form> calls this for the button AND for the Enter key.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stop the browser from reloading the page

    // Already sending? Ignore extra clicks, so we never sign in twice.
    if (loading) return;

    setError("");

    if (!email.trim() || !password) {
      setError(MESSAGES.AUTH.MISSING_EMAIL_AND_PASSWORD);
      return;
    }

    setLoading(true);

    try {
      const result = await postJson(API_ROUTES.ACCOUNTS.SIGNIN, {
        email: email.trim(),
        password,
      });

      if (!result.ok) {
        setError(result.message || MESSAGES.AUTH.SIGNIN_FAILED);
        return;
      }

      // Go back to the page they wanted before signing in ("?next=/messages"),
      // or to the dashboard. safeNextPath only allows pages on OUR site.
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(safeNextPath(next));
    } catch (err) {
      console.error("Sign-in error:", err);
      setError(MESSAGES.COMMON.SERVER_UNREACHABLE);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={text("signinWelcome", "Welcome back")}
      subtitle={text(
              "signinIntro",
              "Sign in to continue to your professional network."
            )}
    >

        <form className="auth-clean-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">{text("email", "Email")}</label>

            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={text("emailPlaceholder", "Enter your email address")}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{text("password", "Password")}</label>

            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={text("passwordPlaceholder", "Enter your password")}
              autoComplete="current-password"
              required
            />
          </div>

          <p className="text-xs text-right mb-2">
            <Link href={ROUTES.FORGOT_PASSWORD}>
              {text("forgotPassword", "Forgot password?")}
            </Link>
          </p>

          {error && (
            <div className="form-error mb-2" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading
              ? text("signingIn", "Signing in...")
              : text("signin", "Sign in")}
          </button>

          <p className="text-xs muted text-center mt-2">
            {text("newToApp", `New to ${APP_CONFIG.NAME}?`)}{" "}
            <Link href={ROUTES.SIGNUP}>
              {text("createAccount", "Create account")}
            </Link>
          </p>
        </form>
    </AuthShell>
  );
}
