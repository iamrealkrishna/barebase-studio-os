// Runs during `npm run build`. Applies database migrations on Vercel, and only where it is safe.
//
// - Vercel Production: migrates the production database.
// - Vercel Preview: migrates the staging database. If a Preview deployment points at the
//   production database host, the build stops before touching it (decisions.md, decision 3).
// - Anywhere else (local builds, CI): never migrates. Use `npm run db:migrate:dev` locally.
//
// Prints hostnames only; never prints the connection string.

import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (env !== "production" && env !== "preview") {
  console.log("migrate-on-deploy: not a Vercel deployment, skipping migrations.");
  process.exit(0);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(`migrate-on-deploy: DATABASE_URL is not set for the ${env} environment.`);
  process.exit(1);
}

let host;
try {
  host = new URL(url).hostname;
} catch {
  console.error("migrate-on-deploy: DATABASE_URL is not a valid URL.");
  process.exit(1);
}

const productionHost = process.env.PRODUCTION_DATABASE_HOST;
if (!productionHost) {
  console.error("migrate-on-deploy: PRODUCTION_DATABASE_HOST is not set, so this build can't tell which database it would migrate. Set it in every Vercel environment.");
  process.exit(1);
}

const pointsAtProduction = host === productionHost;

if (env === "preview" && pointsAtProduction) {
  console.error(`migrate-on-deploy: this Preview deployment points at the production database (${host}). Point Vercel Preview at the staging branch instead. Nothing was migrated.`);
  process.exit(1);
}

if (env === "production" && !pointsAtProduction) {
  console.error(`migrate-on-deploy: this Production deployment points at ${host}, not the production database (${productionHost}). Nothing was migrated.`);
  process.exit(1);
}

console.log(`migrate-on-deploy: applying migrations to ${host} (${env}).`);
execSync("npx prisma migrate deploy", { stdio: "inherit" });
