"use client";

/**
 * Verify-email page: type the 6-digit code that was emailed to you.
 *
 * Sign-up sends people here with "?email=ali@x.com", so the email box
 * is already filled in.
 */

import AuthShell from "../AuthShell";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import { postJson } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { OTP_LENGTH, REDIRECT_DELAY_MS } from "../../config/constants";
import { MESSAGES } from "../../config/messages";
import { ROUTES } from "../../config/routes";
import { useUiContent } from "../../hooks/useUiContent";

export default function VerifyEmailPage() {
  // useSearchParams() needs a <Suspense> around it in Next.js.
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const text = useUiContent();

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);

  // After success, show the "verified" message for a moment, then go to sign in.
  // The "return" stops the timer if the user leaves the page first.
  useEffect(() => {
    if (!verified) return;

    const timer = window.setTimeout(
      () => router.replace(ROUTES.SIGNIN),
      REDIRECT_DELAY_MS
    );
    return () => window.clearTimeout(timer);
  }, [verified, router]);

  function clearMessages() {
    setError("");
    setNotice("");
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verifying || verified) return; // no double clicks

    clearMessages();

    if (!email.trim() || code.length !== OTP_LENGTH) {
      setError(MESSAGES.AUTH.MISSING_EMAIL_AND_CODE);
      return;
    }

    setVerifying(true);

    try {
      const result = await postJson(
        API_ROUTES.ACCOUNTS.EMAIL_VERIFICATION_CONFIRM,
        { email: email.trim(), otp: code }
      );

      if (!result.ok) {
        setError(result.message || MESSAGES.AUTH.INVALID_CODE);
        return;
      }

      setNotice(
        result.message ||
          text("emailVerificationSuccess", "Email verified successfully.")
      );
      setVerified(true);
    } catch (err) {
      console.error("Failed to verify email:", err);
      setError(MESSAGES.COMMON.SERVER_UNREACHABLE);
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (resending) return;

    clearMessages();

    if (!email.trim()) {
      setError(MESSAGES.AUTH.MISSING_EMAIL);
      return;
    }

    setResending(true);

    try {
      const result = await postJson(
        API_ROUTES.ACCOUNTS.EMAIL_VERIFICATION_REQUEST,
        { email: email.trim() }
      );

      if (!result.ok) {
        setError(
          result.message ||
            text("emailVerificationCooldown", "Unable to resend the code right now.")
        );
        return;
      }

      setNotice(
        result.message ||
          text("emailVerificationSent", "A new code was sent to your email.")
      );
    } catch (err) {
      console.error("Failed to resend verification code:", err);
      setError(MESSAGES.COMMON.SERVER_UNREACHABLE);
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      title={text("verifyEmail", "Verify email")}
      subtitle={text("verifyEmailIntro", "Enter the code we sent to your email.")}
    >

        <form className="auth-clean-form" onSubmit={handleVerify} noValidate>
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
              required
            />
          </div>

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
              required
            />
          </div>

          {notice && (
            <div className="notice-banner" role="status">
              {notice}
            </div>
          )}
          {error && (
            <div className="form-error mb-2" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary btn-full"
            disabled={verifying || verified}
          >
            {verifying
              ? text("verifyingOtp", "Verifying...")
              : text("verifyOtp", "Verify code")}
          </button>

          {/* type="button" = this button does NOT submit the form. */}
          <button
            type="button"
            className="btn-outline btn-full"
            onClick={handleResend}
            disabled={resending || verified}
          >
            {resending
              ? text("resendingOtp", "Sending...")
              : text("resendOtp", "Send a new code")}
          </button>

          <p className="text-xs muted text-center mt-2">
            <Link href={ROUTES.SIGNIN}>
              {text("backToSignin", "Back to sign in")}
            </Link>
          </p>
        </form>
    </AuthShell>
  );
}
