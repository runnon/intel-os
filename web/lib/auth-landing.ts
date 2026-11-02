/**
 * Supabase sends a sign-in link to its Site URL (with ?code= or ?token_hash=) when the
 * return address the app asked for isn't on its redirect allow-list. Hand such a landing
 * on to /auth/callback, which finishes the sign-in, instead of dropping the code.
 * Returns the URL to redirect to, or null when there is nothing to forward.
 */
export function authLandingRedirect(url: URL): URL | null {
  if (url.pathname === "/auth/callback") return null;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  if (!code && !tokenHash) return null;
  const out = new URL("/auth/callback", url.origin);
  if (code) out.searchParams.set("code", code);
  if (tokenHash) {
    out.searchParams.set("token_hash", tokenHash);
    const type = url.searchParams.get("type");
    if (type) out.searchParams.set("type", type);
  }
  out.searchParams.set("next", url.searchParams.get("next") ?? url.pathname);
  return out;
}
