import type { NextConfig } from "next";

// One public address. Sign-in cookies belong to a single host, so a sign-in link that
// was requested on one address and opened on another can't finish; send the www and
// vercel.app addresses to intel-os.org. API routes are left alone (the Stripe webhook
// still posts to the vercel.app address, and a webhook won't follow a redirect).
const CANONICAL = "https://intel-os.org";
const ALIASES = ["www.intel-os.org", "intel-os-self.vercel.app"];

const nextConfig: NextConfig = {
  transpilePackages: ["@intel-os/core"],
  async redirects() {
    return ALIASES.map((host) => ({
      source: "/:path((?!api/).*)",
      has: [{ type: "host" as const, value: host }],
      destination: `${CANONICAL}/:path`,
      permanent: false,
    }));
  },
};

export default nextConfig;
