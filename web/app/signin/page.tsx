"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-redirect";

type Mode = "signin" | "signup" | "recover";

function SignInForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const next = safeInternalPath(searchParams.get("next"));
  const callbackError = searchParams.get("error") === "link";

  function selectMode(nextMode: Mode) {
    setMode(nextMode);
    setNotice(null);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === "recover") {
        const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
        });
        if (recoveryError) throw recoveryError;
        setNotice("If that email has an account, a password-reset link is on the way.");
        return;
      }

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          window.location.assign(next);
          return;
        }
        setNotice("Check your email to confirm your account, then continue to Analyst access.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (signInError) throw signInError;
      window.location.assign(next);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signup" ? "Create your account" : mode === "recover" ? "Reset your password" : "Sign in";
  const action = mode === "signup" ? "Create account" : mode === "recover" ? "Send reset link" : "Sign in";
  const passwordReady = mode === "recover" || (mode === "signup" ? password.length >= 8 : password.length > 0);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm border border-[#c9c2ac] bg-[#f5f2ea] p-6">
          <a href="/" className="font-mono text-xs tracking-widest text-[#6b675c] hover:text-[#8a6100]">
            // THEATER PICTURE
          </a>
          <p className="mt-4 font-mono text-[10px] text-[#8a6100]">STEP 1 OF 2 · ACCOUNT</p>
          <h1 className="headline text-2xl mt-1">{title}</h1>
          <p className="text-sm text-black/70 mt-2 leading-relaxed">
            {mode === "recover"
              ? "Enter your account email and we’ll send a secure reset link."
              : "Use your email and password. After sign-in, continue to Analyst plan selection."}
          </p>

          {mode !== "recover" && (
            <div className="mt-5 grid grid-cols-2 border border-[#c9c2ac]" aria-label="Authentication mode">
              <button
                type="button"
                onClick={() => selectMode("signin")}
                className={`px-3 py-2 text-xs font-mono ${mode === "signin" ? "bg-[#171712] text-white" : "bg-white text-[#514d43]"}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => selectMode("signup")}
                className={`border-l border-[#c9c2ac] px-3 py-2 text-xs font-mono ${mode === "signup" ? "bg-[#171712] text-white" : "bg-white text-[#514d43]"}`}
              >
                Create account
              </button>
            </div>
          )}

          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <label className="text-xs font-mono text-[#514d43]">
              Email
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="analyst@example.gov"
                className="mt-1 w-full border border-[#c9c2ac] bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#8a6100]"
              />
            </label>
            {mode !== "recover" && (
              <label className="text-xs font-mono text-[#514d43]">
                Password
                <input
                  type="password"
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 w-full border border-[#c9c2ac] bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#8a6100]"
                />
                {mode === "signup" && <span className="mt-1 block text-[10px] text-[#6b675c]">Use at least eight characters.</span>}
              </label>
            )}
            <button
              type="submit"
              disabled={busy || !email || !passwordReady}
              className="bg-[#171712] text-white text-sm font-semibold py-2.5 hover:bg-[#0b0b3b] disabled:opacity-50"
            >
              {busy ? "Working…" : action}
            </button>
            {mode === "signin" && (
              <button type="button" onClick={() => selectMode("recover")} className="text-xs underline text-[#6b675c] hover:text-[#8a6100]">
                Forgot password?
              </button>
            )}
            {mode === "recover" && (
              <button type="button" onClick={() => selectMode("signin")} className="text-xs underline text-[#6b675c] hover:text-[#8a6100]">
                Back to sign in
              </button>
            )}
            {notice && <p role="status" className="font-mono text-xs text-[#1f4a2e] border border-[#c9c2ac] bg-[#efeadb] px-3 py-3">{notice}</p>}
            {error && <p role="alert" className="font-mono text-xs text-[#8a2f2f]">{error}</p>}
            {!error && callbackError && <p role="alert" className="font-mono text-xs text-[#8a2f2f]">That confirmation or reset link is invalid or expired. Request a new one.</p>}
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
