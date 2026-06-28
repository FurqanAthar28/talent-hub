"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "../../api/client";
import { fetchUiContent, type UiContent } from "../../api/ui-content";

type Step = "request" | "confirm" | "complete";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [uiContent, setUiContent] = useState<UiContent>({});
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadUiContent() {
      try {
        const data = await fetchUiContent();
        setUiContent(data);
      } catch (error) {
        console.error("Failed to load password reset UI content:", error);
        setError(error instanceof Error ? error.message : "");
      }
    }

    loadUiContent();
  }, []);

  async function requestOtp() {
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const res = await apiFetch(uiContent.apiPasswordResetRequest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message);
        return;
      }

      setNotice(data.message);
      setStep("confirm");
    } catch (error) {
      console.error("Failed to request password reset OTP:", error);
      setError(error instanceof Error ? error.message : "");
    } finally {
      setLoading(false);
    }
  }

  async function confirmPasswordReset() {
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const res = await apiFetch(uiContent.apiPasswordResetConfirm, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password }),
      });
      const data = await res.json();

      if (!res.ok) 
      {
        setError(data.message);
        return;
      }

      setNotice(uiContent.passwordResetSuccessRedirect);
      setStep("complete");
      window.setTimeout(() => {
        router.replace(uiContent.routeSignin);
      }, 1500);
    } catch (error) {
      console.error("Failed to confirm password reset:", error);
      setError(error instanceof Error ? error.message : "");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;

    event.preventDefault();

    if (step === "request") {
      requestOtp();
      return;
    }

    if (step === "confirm") {
      confirmPasswordReset();
    }
  }

  if (!uiContent.resetPassword) return null;

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <Link href="/" className="auth-logo">
            {uiContent.appName}
          </Link>

          <h1>{uiContent.resetPassword}</h1>

          <p>
            {step === "request"
              ? uiContent.resetPasswordIntro
              : uiContent.otpSentNextStep}
          </p>
        </div>

        <div className="auth-clean-form">
          <div className="form-group">
            <label htmlFor="email">{uiContent.email}</label>

            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={uiContent.emailPlaceholder}
              autoComplete="email"
              disabled={step !== "request"}
            />
          </div>

          {step !== "request" && (
            <>
              <div className="form-group">
                <label htmlFor="otp">{uiContent.otp}</label>

                <input
                  id="otp"
                  name="otp"
                  type="text"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={uiContent.otpPlaceholder}
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  disabled={step === "complete"}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">{uiContent.newPassword}</label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={uiContent.newPasswordPlaceholder}
                  autoComplete="new-password"
                  disabled={step === "complete"}
                />
              </div>
            </>
          )}

          {error && <div className="form-error mb-2">{error}</div>}
          {notice && <div className="form-success mb-2">{notice}</div>}

          {step === "request" ? (
            <button
              type="button"
              className="btn-primary btn-full"
              disabled={loading || !email.trim()}
              onClick={requestOtp}
            >
              {loading ? uiContent.sendingOtp : uiContent.sendOtp}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary btn-full"
              disabled={
                loading ||
                step === "complete" ||
                !email.trim() ||
                otp.length !== 6 ||
                !password
              }
              onClick={confirmPasswordReset}
            >
              {loading ? uiContent.updatingPassword : uiContent.updatePassword}
            </button>
          )}

          <p className="text-xs muted text-center mt-2">
            <Link href={uiContent.routeSignin}>{uiContent.backToSignin}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
