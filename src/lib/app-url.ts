/**
 * Absolute base URL of this deployment, used to build client share links.
 * Prefers an explicit APP_URL; falls back to whatever Vercel exposes.
 */
export function appUrl(): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;

  const preview = process.env.VERCEL_URL;
  if (preview) return `https://${preview}`;

  return "http://localhost:3000";
}

export function clientLink(token: string): string {
  return `${appUrl()}/c/${token}`;
}
