/** Accept only same-origin path redirects; reject protocol-relative and backslash forms. */
export function safeInternalPath(value: string | null | undefined, fallback = "/analyst"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const base = "https://intel-os.invalid";
    const parsed = new URL(value, base);
    if (parsed.origin !== base) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
