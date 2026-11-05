"use client";

/**
 * Forgot-password page, in 3 steps:
 *   "request"  -> type your email, we send a 6-digit code
 *   "confirm"  -> type the code and a new password
 *   "complete" -> done, we take you to sign in
 */

import AuthShell from "../AuthShell";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { postJson } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import {
  MIN_PASSWORD_LENGTH,
  OTP_LENGTH,
  REDIRECT_DELAY_MS,
} from "../../config/constants";
import { MESSAGES } from "../../config/messages";
import { ROUTES } from "../../config/routes";
import { useUiContent } from "../../hooks/useUiContent";

type Step = "request" | "confirm" | "complete";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const text = useUiContent();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // When the password is changed, wait a moment, then go to sign in.
  // The "return" stops the timer if the user leaves the page first.
  useEffect(() => {
    if (step !== "complete") return;

    const timer = window.setTimeout(
      () => router.replace(ROUTES.SIGNIN),
      REDIRECT_DELAY_MS
    );
    return () => window.clearTimeout(timer);
  }, [step, router]);

  // Step 1: ask Django to email a code.
  async function requestCode() {
    if (!email.trim()) {
      setError(MESSAGES.AUTH.MISSING_EMAIL);
      return;
    }

    const result = await postJson(API_ROUTES.ACCOUNTS.PASSWORD_RESET_REQUEST, {
      email: email.trim(),
    });

    if (!result.ok) {
      setError(result.message || MESSAGES.COMMON.SOMETHING_WENT_WRONG);
      return;
    }

    setNotice(result.message || text("otpSent", "Code sent. Check your email."));
    setStep("confirm");
  }

  // Step 2: send the code and the new password.
  async function confirmReset() {
    if (code.length !== OTP_LENGTH) {
      setError(MESSAGES.AUTH.MISSING_EMAIL_AND_CODE);
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(MESSAGES.AUTH.PASSWORD_TOO_SHORT);
      return;
    }

    const result = await postJson(API_ROUTES.ACCOUNTS.PASSWORD_RESET_CONFIRM, {
      email: email.trim(),
      otp: code,
      password,
    });

    if (!result.ok) {
      setError(result.message || MESSAGES.AUTH.INVALID_CODE);
      return;
    }

    setNotice(
      text(
        "passwordResetSuccessRedirect",
        "Password updated. Taking you to sign in..."
      )
    );
    setStep("complete");
  }

  // One <form> for both steps: the button and the Enter key both land here.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || step === "complete") return; // no double clicks

    setError("");
    setNotice("");
    setLoading(true);

    try {
      if (step === "request") {
        await requestCode();
      } else {
        await confirmReset();
      }
    } catch (err) {
      console.error("Password reset error:", err);
      setError(MESSAGES.COMMON.SERVER_UNREACHABLE);
    } finally {
      setLoading(false);
    }
  }

  // Typed the wrong email? Go back to step 1.
  function changeEmail() {
    setStep("request");
    setCode("");
    setPassword("");
    setError("");
    setNotice("");
  }

  const isRequestStep = step === "request";

  let buttonLabel = text("updatePassword", "Update password");
  if (isRequestStep) {
    buttonLabel = loading
      ? text("sendingOtp", "Sending code...")
      : text("sendOtp", "Send code");
  } else if (loading) {
    buttonLabel = text("updatingPassword", "Updating...");
  }

  return (
    <AuthShell
      title={text("resetPassword", "Reset password")}
      subtitle={isRequestStep
              ? text(
                  "resetPasswordIntro",
                  "Enter your email and we'll send you a code."
                )
              : text(
                  "otpSentNextStep",
                  "Enter the code from your email and choose a new password."
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
              placeholder={text("emailPlaceholder", "Enter your email")}
              autoComplete="email"
              disabled={!isRequestStep}
              required
            />
          </div>

          {!isRequestStep && (
            <>
              <div className="form-group">
                <label htmlFor="otp">{text("otp", "Code")}</label>

                <input
                  id="otp"
                  name="otp"
                  type="text"
                  value={code}
                  // Keep only digits, max 6, so pasting "123 456" still works.
              // (No maxLength here: the browser would cut "123 456" to
              // "123 45" BEFORE we could remove the space.)
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
                  }
                  placeholder={text("otpPlaceholder", "6-digit code")}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={step === "complete"}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">
                  {text("newPassword", "New password")}
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={text(
                    "newPasswordPlaceholder",
                    `At least ${MIN_PASSWORD_LENGTH} characters`
                  )}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  disabled={step === "complete"}
                  required
                />
              </div>
            </>
          )}

          {error && (
            <div className="form-error mb-2" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="form-success mb-2" role="status">
              {notice}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary btn-full"
            disabled={loading || step === "complete"}
          >
            {buttonLabel}
          </button>

          {step === "confirm" && (
            <button
              type="button"
              className="btn-outline btn-full"
              onClick={changeEmail}
              disabled={loading}
            >
              {text("changeEmail", "Use a different email")}
            </button>
          )}

          <p className="text-xs muted text-center mt-2">
            <Link href={ROUTES.SIGNIN}>
              {text("backToSignin", "Back to sign in")}
            </Link>
          </p>
        </form>
    </AuthShell>
  );
}
