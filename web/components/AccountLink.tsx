"use client";

import { useEffect, useState } from "react";

// Header account control: "SIGN IN" (returning here afterwards) or the signed-in
// email with a sign-out button. Rendered after mount so server and client agree.
export default function AccountLink({ className = "" }: { className?: string }) {
  const [state, setState] = useState<{ signedIn: boolean; email: string | null } | null>(null);
  const [here, setHere] = useState("/");

  useEffect(() => {
    setHere(window.location.pathname + window.location.search);
    let live = true;
    fetch("/api/entitlement", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => live && setState({ signedIn: !!d.signedIn, email: d.email ?? null }))
      .catch(() => live && setState({ signedIn: false, email: null }));
    return () => {
      live = false;
    };
  }, []);

  if (!state) return <span className={`font-mono text-[11px] w-16 ${className}`} aria-hidden />;

  if (!state.signedIn) {
    return (
      <a
        href={`/signin?next=${encodeURIComponent(here)}`}
        className={`font-mono text-[11px] px-3 py-1.5 border border-[#171712] text-[#171712] hover:bg-[#eae4d2] ${className}`}
      >
        SIGN IN
      </a>
    );
  }

  return (
    <form action="/auth/signout" method="post" className={`flex items-center gap-2 font-mono text-[11px] ${className}`}>
      <span className="text-[#6b675c] max-w-[160px] truncate" title={state.email ?? undefined}>
        {state.email ?? "Signed in"}
      </span>
      <button type="submit" className="text-[#6b675c] underline hover:text-[#171712]">
        Sign out
      </button>
    </form>
  );
}
