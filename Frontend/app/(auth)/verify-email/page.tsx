"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { apiFetch } from "../../api/client";
import {
  fetchUiContent,
  getUiContentErrorMessage,
  type UiContent,
} from "../../api/ui-content";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [uiContent, setUiContent] = useState<UiContent>({});
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    async function loadUiContent() {
      try {
        const data = await fetchUiContent();
        setUiContent(data);
      } catch (error) {
        setError(getUiContentErrorMessage(error));
      }
    }

    loadUiContent();
  }, []);

  async function verifyEmail() {
    setError("");
    setNotice("");

    if (!email.trim() || !otp.trim()) {
      setError(uiContent.signinMissingFields || "Please enter your email and OTP.");
      return;
    }

    setVerifying(true);

    try {
      const res = await apiFetch(
        uiContent.apiEmailVerificationConfirm ||
          "/accounts/email-verification/confirm/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        },
        { redirectOnUnauthorized: false }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(
          data.message ||
            uiContent.emailVerificationInvalidOtp ||
            "Invalid or expired OTP."
        );
        return;
      }

      setNotice(
        data.message ||
          uiContent.emailVerificationSuccess ||
          "Email verified successfully."
      );

      router.replace(uiContent.routeSignin || "/signin");
    } catch (error) {
      console.error("Failed to verify email:", error);
      setError(uiContent.serverConnectionError || "Unable to connect to server.");
    } finally {
      setVerifying(false);
    }
  }

  async function resendOtp() {
    setError("");
    setNotice("");

    if (!email.trim()) {
      setError(uiContent.signinMissingFields || "Please enter your email.");
      return;
    }

    setResending(true);

    try {
      const res = await apiFetch(
        uiContent.apiEmailVerificationRequest ||
          "/accounts/email-verification/request/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
        { redirectOnUnauthorized: false }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(
          data.message ||
            uiContent.emailVerificationCooldown ||
            "Unable to resend OTP right now."
        );
        return;
      }

      setNotice(
        data.message ||
          uiContent.emailVerificationSent ||
          "Verification OTP sent successfully."
      );
    } catch (error) {
      console.error("Failed to resend verification OTP:", error);
      setError(uiContent.serverConnectionError || "Unable to connect to server.");
    } finally {
      setResending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      verifyEmail();
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <Link href="/" className="auth-logo">
            {uiContent.appName || "ProfessionalHub"}
          </Link>

          <h1>{uiContent.verifyEmail || "Verify Email"}</h1>
          <p>{uiContent.verifyEmailIntro || "Enter the OTP sent to your email."}</p>
        </div>

        <div className="auth-clean-form">
          <div className="form-group">
            <label htmlFor="email">{uiContent.email || "Email"}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={uiContent.emailPlaceholder || "Enter your email"}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="otp">{uiContent.otp || "OTP"}</label>
            <input
              id="otp"
              type="text"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={uiContent.otpPlaceholder || "Enter OTP"}
              inputMode="numeric"
              maxLength={6}
            />
          </div>

          {notice && <div className="notice-banner">{notice}</div>}
          {error && <div className="form-error mb-2">{error}</div>}

          <button
            type="button"
            className="btn-primary btn-full"
            onClick={verifyEmail}
            disabled={verifying}
          >
            {verifying
              ? uiContent.verifyingOtp || "Verifying..."
              : uiContent.verifyOtp || "Verify OTP"}
          </button>

          <button
            type="button"
            className="btn-outline btn-full"
            onClick={resendOtp}
            disabled={resending}
          >
            {resending
              ? uiContent.resendingOtp || "Resending..."
              : uiContent.resendOtp || "Resend OTP"}
          </button>

          <p className="text-xs muted text-center mt-2">
            <Link href={uiContent.routeSignin || "/signin"}>
              {uiContent.backToSignin || "Back to sign in"}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
