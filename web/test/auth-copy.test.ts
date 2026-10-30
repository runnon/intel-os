import { describe, expect, it } from "vitest";
import { friendlyAuthError, signInReason } from "../lib/auth-copy";

describe("sign-in copy", () => {
  it("says why the visitor is signing in, from where they came", () => {
    expect(signInReason("/t/centcom?tab=ask").title).toBe("Sign in to ask");
    expect(signInReason("/analyst").title).toBe("Sign in to draft");
    expect(signInReason("/t/eucom").place).toBe("the map");
    expect(signInReason("/").title).toBe("Sign in");
  });

  it("turns Supabase errors into plain next steps", () => {
    expect(friendlyAuthError(Object.assign(new Error("email rate limit exceeded"), { status: 429 }))).toMatch(/Wait a minute/);
    expect(friendlyAuthError(new Error("Invalid login credentials"))).toMatch(/Email me a link/);
    expect(friendlyAuthError(new Error("Email not confirmed"))).toMatch(/fresh one/);
    expect(friendlyAuthError(new Error("User already registered"))).toMatch(/already an account/);
    expect(friendlyAuthError(new Error("Something odd"))).toBe("Something odd");
  });
});
