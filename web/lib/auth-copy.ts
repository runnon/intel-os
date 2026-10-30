// Sign-in page copy: why the visitor is signing in (from where they came) and
// plain-English versions of the auth errors Supabase returns.

export function signInReason(next: string): { title: string; why: string; place: string } {
  if (/[?&]tab=ask\b/.test(next)) {
    return {
      title: "Sign in to ask",
      why: "Ask questions about any theater in plain language and get answers linked to the events on the map. Free.",
      place: "the map",
    };
  }
  if (/[?&]tab=submit\b/.test(next) || next.startsWith("/submit")) {
    return {
      title: "Sign in to submit a report",
      why: "Share an event from public sources. It appears on the clearly labeled community layer. Free.",
      place: "the map",
    };
  }
  if (next.startsWith("/analyst")) {
    return {
      title: "Sign in to draft",
      why: "Draft facts-only report text from the published picture. Free.",
      place: "the drafting workspace",
    };
  }
  return {
    title: "Sign in",
    why: "A free account lets you ask the AI about any theater, draft reports, and submit community reports.",
    place: next.startsWith("/t/") ? "the map" : "where you were",
  };
}

export function friendlyAuthError(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const status = (e as { status?: number } | null)?.status;
  const m = raw.toLowerCase();
  if (status === 429 || m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) {
    return "Too many emails were requested just now. Wait a minute and try again, or sign in with a password.";
  }
  if (m.includes("invalid login credentials")) {
    return "That email and password don't match. New here? Use \"Email me a link\" instead; it works for new accounts too.";
  }
  if (m.includes("email not confirmed")) {
    return "This account hasn't been confirmed yet. Use \"Email me a link\" and we'll send a fresh one.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "There's already an account for this email. Sign in, or use \"Email me a link\".";
  }
  if (m.includes("password") && (m.includes("weak") || m.includes("pwned") || m.includes("leaked") || m.includes("at least"))) {
    return "Choose a stronger password: at least eight characters, and not one that has appeared in a data breach.";
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) {
    return "New accounts are paused right now. Try again later.";
  }
  if (m.includes("provider is not enabled")) {
    return "That sign-in option isn't available. Use your email instead.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Couldn't reach the sign-in service. Check your connection and try again.";
  }
  return raw || "Sign-in failed. Try again.";
}
