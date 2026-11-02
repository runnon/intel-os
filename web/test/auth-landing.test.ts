import { describe, expect, it } from 'vitest';
import { authLandingRedirect } from '../lib/auth-landing';

describe('authLandingRedirect', () => {
  it('forwards a sign-in code that landed on the home page to the callback', () => {
    const out = authLandingRedirect(new URL('https://intel-os.org/?code=abc123'));
    expect(out?.toString()).toBe('https://intel-os.org/auth/callback?code=abc123&next=%2F');
  });

  it('forwards a token-hash link with its type', () => {
    const out = authLandingRedirect(new URL('https://intel-os.org/?token_hash=h&type=magiclink'));
    expect(out?.searchParams.get('token_hash')).toBe('h');
    expect(out?.searchParams.get('type')).toBe('magiclink');
    expect(out?.pathname).toBe('/auth/callback');
  });

  it('leaves ordinary pages and the callback itself alone', () => {
    expect(authLandingRedirect(new URL('https://intel-os.org/t/centcom?w=all'))).toBeNull();
    expect(authLandingRedirect(new URL('https://intel-os.org/auth/callback?code=abc'))).toBeNull();
  });
});
