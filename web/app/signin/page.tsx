"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-redirect";
import { friendlyAuthError, signInReason } from "@/lib/auth-copy";

// One field first: "email me a sign-in link" works for new and returning people
// alike, so nobody has to pick "sign in" vs "create account" or remember a password.
// Passwords stay available; Google appears automatically once enabled in Supabase.
type Mode = "link" | "password" | "signup" | "recover" | "sent";

const RESEND_SECONDS = 60;

function SignInForm() {
  const searchParams = useSearchParams();
  const next = safeInternalPath(searchParams.get("next"), "/");
  const callbackError = searchParams.get("error") === "link";
  const reason = signInReason(next);

  const [mode, setMode] = useState<Mode>("link");
  const [sentKind, setSentKind] = useState<"link" | "confirm" | "reset">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [google, setGoogle] = useState(false);

  // Show "Continue with Google" only when the provider is actually enabled.
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => r.json())
      .then((s) => setGoogle(!!s?.external?.google))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const normalized = () => email.trim().toLowerCase();

  function go(m: Mode) {
    setMode(m);
    setError(null);
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  const sendLink = () =>
    run(async () => {
      const { error: e } = await createSupabaseBrowserClient().auth.signInWithOtp({
        email: normalized(),
        options: { emailRedirectTo: callback(), shouldCreateUser: true },
      });
      if (e) throw e;
      setSentKind("link");
      setCooldown(RESEND_SECONDS);
      setMode("sent");
    });

  const signInWithPassword = () =>
    run(async () => {
      const { error: e } = await createSupabaseBrowserClient().auth.signInWithPassword({ email: normalized(), password });
      if (e) throw e;
      window.location.assign(next);
    });

  const signUp = () =>
    run(async () => {
      const { data, error: e } = await createSupabaseBrowserClient().auth.signUp({
        email: normalized(),
        password,
        options: { emailRedirectTo: callback() },
      });
      if (e) throw e;
      if (data.session) {
        window.location.assign(next);
        return;
      }
      setSentKind("confirm");
      setCooldown(RESEND_SECONDS);
      setMode("sent");
    });

  const recover = () =>
    run(async () => {
      const { error: e } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(normalized(), {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      });
      if (e) throw e;
      setSentKind("reset");
      setCooldown(RESEND_SECONDS);
      setMode("sent");
    });

  const withGoogle = () =>
    run(async () => {
      const { error: e } = await createSupabaseBrowserClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback() },
      });
      if (e) throw e;
    });

  const inputCls =
    "mt-1 w-full border border-[#c9c2ac] bg-white px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#8a6100]";
  const primaryCls =
    "w-full bg-[#171712] text-white text-sm font-semibold py-2.5 hover:bg-[#0b0b3b] disabled:opacity-50";
  const linkCls = "text-xs underline text-[#6b675c] hover:text-[#8a6100]";

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm border border-[#c9c2ac] bg-[#f5f2ea] p-6">
          <a href="/" className="font-mono text-xs tracking-widest text-[#6b675c] hover:text-[#8a6100]">
            // THEATER PICTURE
          </a>

          {mode === "sent" ? (
            <div className="mt-5" role="status">
              <h1 className="headline text-2xl">Check your email</h1>
              <p className="text-sm text-black/75 mt-2 leading-relaxed">
                {sentKind === "reset" ? "We sent a password-reset link to " : sentKind === "confirm" ? "We sent a confirmation link to " : "We sent a sign-in link to "}
                <strong className="break-all">{normalized()}</strong>.{" "}
                {sentKind === "reset"
                  ? "Open it to choose a new password."
                  : `Open it in this browser and you'll be signed in and taken back to ${reason.place}.`}
              </p>
              <ul className="mt-3 text-xs text-[#6b675c] space-y-1 list-disc pl-4">
                <li>It can take a minute to arrive. Check spam or promotions.</li>
                <li>Open the link on this same device and browser.</li>
              </ul>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy || cooldown > 0}
                  onClick={sentKind === "reset" ? recover : sentKind === "confirm" ? signUp : sendLink}
                  className="w-full border border-[#171712] text-sm py-2 hover:bg-[#eae4d2] disabled:opacity-50"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : busy ? "Sending…" : "Resend email"}
                </button>
                <button type="button" onClick={() => go("link")} className={linkCls}>
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-4 font-mono text-[10px] text-[#8a6100]">FREE ACCOUNT</p>
              <h1 className="headline text-2xl mt-1">
                {mode === "recover" ? "Reset your password" : mode === "signup" ? "Create a password account" : reason.title}
              </h1>
              <p className="text-sm text-black/70 mt-2 leading-relaxed">
                {mode === "recover" ? "Enter your account email and we'll send a reset link." : reason.why}
              </p>

              {google && mode !== "recover" && (
                <>
                  <button type="button" onClick={withGoogle} disabled={busy} className="mt-5 w-full border border-[#171712] bg-white text-sm py-2.5 hover:bg-[#eae4d2] disabled:opacity-50">
                    Continue with Google
                  </button>
                  <div className="my-4 flex items-center gap-3 text-[10px] font-mono text-[#918c7d]">
                    <span className="flex-1 border-t border-[#c9c2ac]" /> OR <span className="flex-1 border-t border-[#c9c2ac]" />
                  </div>
                </>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void (mode === "link" ? sendLink() : mode === "password" ? signInWithPassword() : mode === "signup" ? signUp() : recover());
                }}
                className={`${google && mode !== "recover" ? "" : "mt-5"} flex flex-col gap-3`}
              >
                <label className="text-xs font-mono text-[#514d43]">
                  Email
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputCls}
                  />
                </label>

                {(mode === "password" || mode === "signup") && (
                  <label className="text-xs font-mono text-[#514d43]">
                    Password
                    <input
                      type="password"
                      required
                      minLength={mode === "signup" ? 8 : undefined}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputCls}
                    />
                    {mode === "signup" && <span className="mt-1 block text-[10px] text-[#6b675c]">At least eight characters.</span>}
                  </label>
                )}

                <button
                  type="submit"
                  disabled={busy || !email.trim() || ((mode === "password" || mode === "signup") && (mode === "signup" ? password.length < 8 : !password))}
                  className={primaryCls}
                >
                  {busy
                    ? "Working…"
                    : mode === "link"
                      ? "Email me a sign-in link"
                      : mode === "password"
                        ? "Sign in"
                        : mode === "signup"
                          ? "Create account"
                          : "Send reset link"}
                </button>

                {error && <p role="alert" className="text-xs text-[#8a2f2f] leading-snug">{error}</p>}
                {!error && callbackError && (
                  <p role="alert" className="text-xs text-[#8a2f2f] leading-snug">
                    That link didn&apos;t work. It may have expired, been used already, or been opened in a different browser.
                    Enter your email to get a fresh one.
                  </p>
                )}

                <div className="flex flex-col items-center gap-1.5 pt-1">
                  {mode === "link" && (
                    <button type="button" onClick={() => go("password")} className={linkCls}>
                      Sign in with a password instead
                    </button>
                  )}
                  {mode === "password" && (
                    <>
                      <button type="button" onClick={() => go("recover")} className={linkCls}>Forgot password?</button>
                      <button type="button" onClick={() => go("signup")} className={linkCls}>New here? Create a password account</button>
                      <button type="button" onClick={() => go("link")} className={linkCls}>Email me a link instead</button>
                    </>
                  )}
                  {(mode === "signup" || mode === "recover") && (
                    <button type="button" onClick={() => go("link")} className={linkCls}>Back</button>
                  )}
                </div>
              </form>
              <p className="mt-5 text-[11px] text-[#918c7d] leading-snug">
                We only use your email to sign you in. Open sources only · not an official government product.
              </p>
            </>
          )}
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
