/** @type {import('next').NextConfig} */
const nextConfig = {
  // Product rename (2026-07-21): Clients → Accounts, Accounts → Groups.
  // Old URLs stay alive. Order matters: the old group-accounts path must win
  // before the catch-all client-slug rule.
  async redirects() {
    return [
      { source: "/clients/accounts", destination: "/accounts/groups", permanent: false },
      { source: "/clients/accounts/:path*", destination: "/accounts/groups/:path*", permanent: false },
      { source: "/clients", destination: "/accounts", permanent: false },
      { source: "/clients/:path*", destination: "/accounts/:path*", permanent: false },
      // Vendor cost moved out of Admin into its own section (#130).
      { source: "/admin/vendor-cost", destination: "/vendors", permanent: false },
      { source: "/admin/vendor-cost/:vendor", destination: "/vendors/:vendor", permanent: false },
    ];
  },
};

module.exports = nextConfig;
