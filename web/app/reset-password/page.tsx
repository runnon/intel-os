"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await createSupabaseBrowserClient().auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    window.location.assign("/analyst");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-sm border border-[#c9c2ac] bg-[#f5f2ea] p-6">
        <a href="/" className="font-mono text-xs tracking-widest text-[#6b675c] hover:text-[#8a6100]">// THEATER PICTURE</a>
        <h1 className="headline text-2xl mt-4">Choose a new password</h1>
        <form onSubmit={updatePassword} className="mt-5 flex flex-col gap-3">
          <label className="text-xs font-mono text-[#514d43]">
            New password
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full border border-[#c9c2ac] bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#8a6100]"
            />
          </label>
          <label className="text-xs font-mono text-[#514d43]">
            Confirm password
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="mt-1 w-full border border-[#c9c2ac] bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#8a6100]"
            />
          </label>
          <button type="submit" disabled={busy || password.length < 8 || confirm.length < 8} className="bg-[#171712] text-white text-sm font-semibold py-2.5 hover:bg-[#0b0b3b] disabled:opacity-50">
            {busy ? "Updating…" : "Update password"}
          </button>
          {error && <p role="alert" className="font-mono text-xs text-[#8a2f2f]">{error}</p>}
        </form>
      </section>
    </main>
  );
}
