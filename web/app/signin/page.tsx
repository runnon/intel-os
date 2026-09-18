"use client";

import { Suspense, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-redirect";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const next = safeInternalPath(new URLSearchParams(window.location.search).get("next"));
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm border border-[#c9c2ac] bg-[#f5f2ea] p-6">
          <a href="/" className="font-mono text-xs tracking-widest text-[#6b675c] hover:text-[#8a6100]">
            // THEATER PICTURE
          </a>
          <h1 className="headline text-2xl mt-2">Analyst sign-in</h1>
          <p className="text-sm text-black/70 mt-2 leading-relaxed">
            The current 72-hour situation map is free and open. Sign in for the archive,
            drafting workspace, and seven-day Analyst trial — a magic link goes to your email.
          </p>

          {sent ? (
            <p className="mt-5 font-mono text-xs text-[#1f4a2e] border border-[#c9c2ac] bg-[#efeadb] px-3 py-3">
              Check <strong>{email}</strong> for a sign-in link.
            </p>
          ) : (
            <form onSubmit={send} className="mt-5 flex flex-col gap-3">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@example.gov"
                className="border border-[#c9c2ac] bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#8a6100]"
              />
              <button
                type="submit"
                disabled={busy || !email}
                className="bg-[#171712] text-white text-sm font-semibold py-2 hover:bg-[#0b0b3b] disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send magic link"}
              </button>
              {error && <p className="font-mono text-xs text-[#8a2f2f]">{error}</p>}
            </form>
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
