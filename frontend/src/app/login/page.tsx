"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { BouncingDots } from "@/components/ui/bouncing-dots";
import { ArrowRight, Mail, Lock, User, Loader2, KeyRound, CheckCircle2, RotateCcw } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, login, register, verifyEmailCode, resendVerificationCode } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

  // Check URL parameters for OAuth notices or errors
  useEffect(() => {
    if (typeof window !== "undefined") {
      const err = new URLSearchParams(window.location.search).get("error");
      if (err === "google_oauth_not_configured") {
        setOauthNotice("Google OAuth requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET configured in .env.");
      } else if (err === "google_auth_canceled") {
        setOauthNotice("Google sign-in was canceled.");
      } else if (err === "token_exchange_failed") {
        setOauthNotice("Failed to exchange authentication code with Google. Please verify your client secret and redirect URIs.");
      } else if (err === "userinfo_fetch_failed") {
        setOauthNotice("Failed to fetch verified user profile from Google.");
      } else if (err === "backend_auth_failed") {
        setOauthNotice("Failed to register session with backend service.");
      } else if (err === "oauth_internal_error") {
        setOauthNotice("Google authentication encountered a network or resolution error. Please try again.");
      } else if (err) {
        setOauthNotice(`Google sign-in notice: ${decodeURIComponent(err)}`);
      }
    }
  }, []);

  // If already authenticated across tabs or sessions, redirect directly to /chat
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/app/dashboard");
    }
  }, [isAuthenticated, router]);

  if (isAuthLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <BouncingDots size="lg" label="Entering workspace…" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      if (isRegisterMode) {
        if (!name.trim()) throw new Error("Please enter your full name");
        if (!email.trim() || !password.trim()) throw new Error("Email and password are required");
        const res = await register(email.trim(), password, name.trim());
        if (res.verification_required) {
          setIsVerifying(true);
          setDemoCode(res.code || null);
          setInfoMessage(`We sent a 6-digit verification code to ${email.trim()}.`);
          return;
        }
      } else {
        if (!email.trim() || !password.trim()) throw new Error("Email and password are required");
        const res = await login(email.trim(), password);
        if (res && (res as any).verification_required) {
          setIsVerifying(true);
          setDemoCode((res as any).code || null);
          setInfoMessage(`Please enter the 6-digit verification code sent to ${email.trim()}.`);
          return;
        }
      }
      window.location.href = "/app/dashboard";
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setError("Please enter the 6-digit verification code");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      await verifyEmailCode(email.trim(), verificationCode.trim());
      window.location.href = "/app/dashboard";
    } catch (err: any) {
      setError(err.message || "Invalid verification code. Please check and retry.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await resendVerificationCode(email.trim());
      setDemoCode(res.code || null);
      setInfoMessage(`A new verification code was generated for ${email.trim()}.`);
    } catch (err: any) {
      setError(err.message || "Failed to resend code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 selection:bg-manilla selection:text-ink">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block font-display font-semibold text-2xl tracking-tight text-ink mb-2">
            Draythos
          </Link>
          <p className="font-reading text-sm text-ink-soft">
            {isVerifying
              ? "Verify your email to enter workspace"
              : isRegisterMode
              ? "Create a verified workspace account"
              : "Sign in to your document workspace"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-hairline rounded-2xl p-6 md:p-8 shadow-xs">
          {isVerifying ? (
            /* ── Verification Step ── */
            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div className="text-center pb-2">
                <div className="w-10 h-10 rounded-full bg-clay/10 text-clay flex items-center justify-center mx-auto mb-3">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h2 className="font-display font-medium text-sm text-ink mb-1">
                  Email Verification
                </h2>
                <p className="font-reading text-xs text-ink-soft">
                  Enter the 6-digit code sent to <span className="font-medium text-ink">{email}</span>
                </p>
              </div>

              {infoMessage && (
                <div className="p-3 bg-oat border border-hairline rounded-lg text-xs text-ink leading-relaxed flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-clay shrink-0 mt-0.5" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {demoCode && (
                <div className="p-2.5 bg-manilla/50 border border-clay/20 rounded-lg text-xs font-mono text-ink flex items-center justify-between">
                  <span>Verification Code: <strong className="text-clay-deep">{demoCode}</strong></span>
                  <button
                    type="button"
                    onClick={() => setVerificationCode(demoCode)}
                    className="text-[11px] font-display text-clay hover:underline underline-offset-2 ml-2"
                  >
                    Auto-fill
                  </button>
                </div>
              )}

              <div>
                <label className="block font-display text-xs font-medium text-ink mb-1.5">
                  6-Digit Code
                </label>
                <Input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  icon={<KeyRound className="h-4 w-4" />}
                  className="font-mono text-center tracking-widest text-base"
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-3 bg-clay/10 border border-clay/20 rounded-lg text-xs text-clay-deep leading-relaxed">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-2"
                disabled={isLoading || verificationCode.length < 6}
                iconRight={isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              >
                {isLoading ? "Verifying…" : "Verify & Activate Workspace"}
              </Button>

              <div className="flex items-center justify-between pt-3 border-t border-hairline text-xs font-display text-cloud-dark">
                <button
                  type="button"
                  onClick={handleResend}
                  className="hover:text-ink transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Resend code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsVerifying(false);
                    setError(null);
                    setInfoMessage(null);
                  }}
                  className="hover:text-ink transition-colors"
                >
                  Change email
                </button>
              </div>
            </form>
          ) : (
            /* ── Sign In / Register Step ── */
            <>
              {/* Mode Switcher */}
              <div className="flex border-b border-hairline mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(false);
                    setError(null);
                  }}
                  className={`flex-1 pb-3 text-sm font-display font-medium text-center border-b-2 transition-colors ${
                    !isRegisterMode ? "border-clay text-ink" : "border-transparent text-cloud-dark hover:text-ink"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(true);
                    setError(null);
                  }}
                  className={`flex-1 pb-3 text-sm font-display font-medium text-center border-b-2 transition-colors ${
                    isRegisterMode ? "border-clay text-ink" : "border-transparent text-cloud-dark hover:text-ink"
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Google OAuth Button */}
              <div className="mb-4">
                <a
                  href="/api/auth/google"
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-hairline bg-surface hover:bg-oat text-ink text-sm font-display font-medium transition-colors shadow-2xs"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </a>

                {oauthNotice && (
                  <div className="mt-2.5 p-2.5 rounded-lg bg-clay/10 border border-clay/20 text-xs font-reading text-clay-deep leading-relaxed">
                    {oauthNotice}
                  </div>
                )}

                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-hairline" />
                  </div>
                  <div className="relative bg-surface px-2 text-[10px] font-mono uppercase text-cloud-dark">
                    or continue with email
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegisterMode && (
                  <div>
                    <label className="block font-display text-xs font-medium text-ink mb-1.5">
                      Full Name
                    </label>
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Atharva Rao"
                      icon={<User className="h-4 w-4" />}
                      required={isRegisterMode}
                      autoFocus
                    />
                  </div>
                )}

                <div>
                  <label className="block font-display text-xs font-medium text-ink mb-1.5">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    icon={<Mail className="h-4 w-4" />}
                    required
                    autoFocus={!isRegisterMode}
                  />
                </div>

                <div>
                  <label className="block font-display text-xs font-medium text-ink mb-1.5">
                    Password
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    icon={<Lock className="h-4 w-4" />}
                    required
                  />
                </div>

                {error && (
                  <div className="p-3 bg-clay/10 border border-clay/20 rounded-lg text-xs text-clay-deep leading-relaxed">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-2"
                  disabled={isLoading}
                  iconRight={isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                >
                  {isLoading
                    ? isRegisterMode
                      ? "Sending code…"
                      : "Signing in…"
                    : isRegisterMode
                    ? "Register & Get Code"
                    : "Enter Workspace"}
                </Button>
              </form>

              {/* Quick Demo Helper */}
              {!isRegisterMode && (
                <div className="mt-5 pt-4 border-t border-hairline/60 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("demo@draythos.internal");
                      setPassword("demo1234");
                    }}
                    className="text-[11px] font-display text-cloud-dark hover:text-clay transition-colors"
                  >
                    Fill verified demo credentials (demo@draythos.internal)
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Back to home */}
        <div className="text-center mt-6">
          <Link href="/" className="font-display text-xs text-ink-soft hover:text-ink transition-colors">
            ← Back to overview
          </Link>
        </div>
      </div>
    </div>
  );
}
