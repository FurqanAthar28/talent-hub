"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { apiFetch } from "../../api/client";
import { fetchUiContent, type UiContent } from "../../api/ui-content";

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
        console.error("Failed to load email verification UI content:", error);
        setError(error instanceof Error ? error.message : "");
      }
    }

    loadUiContent();
  }, []);

  async function verifyEmail() {
    setError("");
    setNotice("");

    if (!email.trim() || !otp.trim()) {
      setError(uiContent.signinMissingFields);
      return;
    }

    setVerifying(true);

    try {
      const res = await apiFetch(
        uiContent.apiEmailVerificationConfirm,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        },
        { redirectOnUnauthorized: false }
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || uiContent.emailVerificationInvalidOtp);
        return;
      }

      setNotice(data.message || uiContent.emailVerificationSuccess);
      router.replace(uiContent.routeSignin);
    } catch (error) {
      console.error("Failed to verify email:", error);
      setError(uiContent.serverConnectionError);
    } finally {
      setVerifying(false);
    }
  }

  async function resendOtp() {
    setError("");
    setNotice("");

    if (!email.trim()) {
      setError(uiContent.signinMissingFields);
      return;
    }

    setResending(true);

    try {
      const res = await apiFetch(
        uiContent.apiEmailVerificationRequest,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
        { redirectOnUnauthorized: false }
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || uiContent.emailVerificationCooldown);
        return;
      }

      setNotice(data.message || uiContent.emailVerificationSent);
    } catch (error) {
      console.error("Failed to resend verification OTP:", error);
      setError(uiContent.serverConnectionError);
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

  if (!uiContent.verifyEmail) return null;

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <Link href="/" className="auth-logo">
            {uiContent.appName}
          </Link>

          <h1>{uiContent.verifyEmail}</h1>
          <p>{uiContent.verifyEmailIntro}</p>
        </div>

        <div className="auth-clean-form">
          <div className="form-group">
            <label htmlFor="email">{uiContent.email}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={uiContent.emailPlaceholder}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="otp">{uiContent.otp}</label>
            <input
              id="otp"
              type="text"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={uiContent.otpPlaceholder}
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
            {verifying ? uiContent.verifyingOtp : uiContent.verifyOtp}
          </button>

          <button
            type="button"
            className="btn-outline btn-full"
            onClick={resendOtp}
            disabled={resending}
          >
            {resending ? uiContent.resendingOtp : uiContent.resendOtp}
          </button>

          <p className="text-xs muted text-center mt-2">
            <Link href={uiContent.routeSignin}>{uiContent.backToSignin}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
