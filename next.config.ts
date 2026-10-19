import type { NextConfig } from "next";

/**
 * Routes follow docs/screens-and-journeys.md. The UI spec's older URLs for the same
 * screens redirect permanently (decisions.md, kit v2 question 1).
 */
const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/projects/:id/budget", destination: "/projects/:id/home-budget", permanent: true },
      { source: "/projects/:id/budget/purchases", destination: "/projects/:id/home-budget/purchases", permanent: true },
      { source: "/projects/:id/finance/client", destination: "/projects/:id/finance/payments", permanent: true },
      { source: "/projects/:id/finance/vendor", destination: "/projects/:id/finance/vendors", permanent: true },
      { source: "/projects/:id/milestones/dpr/new", destination: "/site/:id/dpr", permanent: true },
      { source: "/projects/:id/snags/walk", destination: "/site/:id/snag/new", permanent: true },
      { source: "/finance/gst", destination: "/finance/tax", permanent: true },
      { source: "/settings/catalogue", destination: "/settings/rate-card", permanent: true },
      { source: "/settings/organisation", destination: "/settings", permanent: true },
      { source: "/c/:token/progress", destination: "/c/:token", permanent: true },
    ];
  },
};

export default nextConfig;
