import { readFile } from "node:fs/promises";
import path from "node:path";

import { getSessionUser } from "@/lib/auth";

/**
 * Serves the mock-up PNGs in docs/ui to signed-in staff, for the placeholder pages.
 * Only docs/ui/screens and docs/ui/reference, only .png, no path tricks.
 */
const ROOT = path.join(process.cwd(), "docs", "ui");
const ALLOWED = new Set(["screens", "reference"]);

export async function GET(_request: Request, { params }: { params: Promise<{ file: string[] }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Not found", { status: 404 });

  const { file } = await params;
  if (file.length !== 2 || !ALLOWED.has(file[0]) || !/^[\w.-]+\.png$/.test(file[1])) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const body = await readFile(path.join(ROOT, file[0], file[1]));
    return new Response(new Uint8Array(body), {
      headers: { "content-type": "image/png", "cache-control": "private, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
