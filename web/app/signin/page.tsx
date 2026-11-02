"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-redirect";
import { friendlyAuthError, signInReason } from "@/lib/auth-copy";

// Email first, then a 6-digit code typed on this page (the AlleyKat/Runnon pattern).
// The same code signs in a returning reader and creates the account for a new one, so
// nobody chooses between "sign in" and "sign up", and there's no link to open in the
// right browser. A password stays available for anyone who set one.
type Mode = "email" | "code" | "password";

const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;

function SignInForm() {
  const searchParams = useSearchParams();
  const next = safeInternalPath(searchParams.get("next"), "/");
  const callbackError = searchParams.get("error") === "link";
  const reason = signInReason(next);

  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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

  const sendCode = () =>
    run(async () => {
      const { error: e } = await createSupabaseBrowserClient().auth.signInWithOtp({
        email: normalized(),
        options: { shouldCreateUser: true, emailRedirectTo: callback() },
      });
      if (e) throw e;
      setCode("");
      setCooldown(RESEND_SECONDS);
      setMode("code");
    });

  const checkCode = () =>
    run(async () => {
      const { error: e } = await createSupabaseBrowserClient().auth.verifyOtp({
        email: normalized(),
        token: code,
        type: "email",
      });
      if (e) throw e;
      window.location.assign(next);
    });

  const signInWithPassword = () =>
    run(async () => {
      const { error: e } = await createSupabaseBrowserClient().auth.signInWithPassword({ email: normalized(), password });
      if (e) throw e;
      window.location.assign(next);
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
  const errorLine = error && <p role="alert" className="text-xs text-[#8a2f2f] leading-snug">{error}</p>;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm border border-[#c9c2ac] bg-[#f5f2ea] p-6">
          <a href="/" className="font-mono text-xs tracking-widest text-[#6b675c] hover:text-[#8a6100]">
            // THEATER PICTURE
          </a>

          {mode === "code" ? (
            <form
              className="mt-5 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void checkCode();
              }}
            >
              <h1 className="headline text-2xl">Check your email</h1>
              <p className="text-sm text-black/75 leading-relaxed">
                We sent a {CODE_LENGTH}-digit code to <strong className="break-all">{normalized()}</strong>. Type it here to
                sign in.
              </p>
              <label className="text-xs font-mono text-[#514d43]">
                Code
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder={"0".repeat(CODE_LENGTH)}
                  className={`${inputCls} font-mono text-2xl tracking-[0.3em] text-center`}
                />
              </label>
              <button type="submit" disabled={busy || code.length < CODE_LENGTH} className={primaryCls}>
                {busy ? "Checking…" : "Sign in"}
              </button>
              {errorLine}
              <p className="text-xs text-[#6b675c] leading-snug">
                It can take a minute to arrive. Check spam or promotions. The code works on any device.
              </p>
              <div className="flex flex-col items-center gap-1.5 pt-1">
                <button type="button" disabled={busy || cooldown > 0} onClick={sendCode} className={`${linkCls} disabled:no-underline disabled:opacity-60`}>
                  {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
                </button>
                <button type="button" onClick={() => go("email")} className={linkCls}>
                  Use a different email
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="mt-4 font-mono text-[10px] text-[#8a6100]">FREE ACCOUNT</p>
              <h1 className="headline text-2xl mt-1">{reason.title}</h1>
              <p className="text-sm text-black/70 mt-2 leading-relaxed">{reason.why}</p>

              {google && (
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
                  void (mode === "email" ? sendCode() : signInWithPassword());
                }}
                className={`${google ? "" : "mt-5"} flex flex-col gap-3`}
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

                {mode === "password" && (
                  <label className="text-xs font-mono text-[#514d43]">
                    Password
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                )}

                <button
                  type="submit"
                  disabled={busy || !email.trim() || (mode === "password" && !password)}
                  className={primaryCls}
                >
                  {busy ? "Working…" : mode === "email" ? "Continue" : "Sign in"}
                </button>

                {errorLine}
                {!error && callbackError && (
                  <p role="alert" className="text-xs text-[#8a2f2f] leading-snug">
                    That sign-in link didn&apos;t work. Enter your email and we&apos;ll send a code instead.
                  </p>
                )}

                {mode === "email" ? (
                  <>
                    <p className="text-xs text-[#6b675c] leading-snug">
                      We&apos;ll email you a {CODE_LENGTH}-digit code. It works whether or not you have an account yet.
                    </p>
                    <button type="button" onClick={() => go("password")} className={`${linkCls} self-center pt-1`}>
                      Sign in with a password instead
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 pt-1">
                    <button type="button" onClick={() => (email.trim() ? void sendCode() : go("email"))} className={linkCls}>
                      Forgot it? Email me a code
                    </button>
                    <button type="button" onClick={() => go("email")} className={linkCls}>
                      Back
                    </button>
                  </div>
                )}
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
