import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Line-item reference photos are posted as compressed data URLs, so the
  // default 1 MB Server Action body limit is too tight for a section-sized save.
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },

  // The placeholder pages show the mock-ups from docs/ui, so the route serving them ships them.
  outputFileTracingIncludes: {
    "/mockups/[...file]": ["./docs/ui/screens/*.png", "./docs/ui/reference/*.png"],
  },

  async redirects() {
    return [
      // BOQ Studio's project routes moved under the project's BOQ tab (docs/PLAN.md, route map).
      // `/projects/:id` itself is now the project Overview; the versions page is /boq/versions.
      { source: "/projects/:id/build", destination: "/projects/:id/boq", permanent: true },
      { source: "/projects/:id/client-view", destination: "/projects/:id/boq/client-view", permanent: true },
      { source: "/projects/:id/review", destination: "/projects/:id/boq/review", permanent: true },

      // The UI spec's older URLs for screens the screens file names differently
      // (decisions.md, kit v2 question 1).
      { source: "/projects/:id/budget", destination: "/projects/:id/home-budget", permanent: true },
      { source: "/projects/:id/budget/purchases", destination: "/projects/:id/home-budget/purchases", permanent: true },
      { source: "/projects/:id/finance/client", destination: "/projects/:id/finance/payments", permanent: true },
      { source: "/projects/:id/finance/vendor", destination: "/projects/:id/finance/vendors", permanent: true },
      { source: "/projects/:id/milestones/dpr/new", destination: "/site/:id/dpr", permanent: true },
      { source: "/projects/:id/snags/walk", destination: "/site/:id/snag/new", permanent: true },
      { source: "/finance/gst", destination: "/finance/tax", permanent: true },
      { source: "/settings/catalogue", destination: "/settings/rate-card", permanent: true },
      { source: "/settings/organisation", destination: "/settings", permanent: true },
      { source: "/profile", destination: "/account", permanent: true },
      // The client's estimate stays at the link clients already hold until Phase 4 (P4-7).
      { source: "/c/:token/estimate", destination: "/c/:token", permanent: false },
    ];
  },
};

export default nextConfig;
