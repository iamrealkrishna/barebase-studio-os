import { expect, type Locator, type Page } from "@playwright/test";
import zlib from "node:zlib";

/**
 * Everything this suite creates is named with this prefix so it can be found
 * and removed afterwards — see tests/cleanup.ts. Never change it without
 * changing the cleanup script to match.
 */
export const PREFIX = "PLAYWRIGHT TEST";

/** One id per run, so a re-run doesn't collide with what the last one left. */
export const RUN_ID = process.env.E2E_RUN_ID ?? String(Date.now()).slice(-6);

export function testName(label: string): string {
  return `${PREFIX} ${label} ${RUN_ID}`;
}

/** Emails are prefixed too, so cleanup can match on either name or email. */
export function testEmail(label: string): string {
  return `playwright-test-${label}-${RUN_ID}@example.invalid`;
}

export const ADMIN = {
  email: process.env.E2E_EMAIL ?? "krishna@barebase.in",
  password: process.env.E2E_PASSWORD ?? "barebase123",
};

// --------------------------------------------------------------------- auth

export async function login(page: Page, email = ADMIN.email, password = ADMIN.password) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/projects", { timeout: 45_000 });
}

/** Sign in expecting to be refused — returns the error the form showed. */
export async function loginExpectingFailure(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  return {
    url: new URL(page.url()).pathname,
    error: (await page.locator(".auth-error").count()) ? await page.locator(".auth-error").innerText() : "",
  };
}

// ----------------------------------------------------------------- projects

export async function createProject(page: Page, name: string, client = `${PREFIX} Client`) {
  await page.goto("/projects");
  await page.click("text=＋ Add project");
  await page.fill("#np-name", name);
  await page.fill("#np-client", client);
  await page.click('button:has-text("Create project")');
  await page.waitForURL("**/boq", { timeout: 45_000 });
  await page.waitForSelector(".sec-block");
  const id = page.url().match(/projects\/([^/]+)\/boq/)?.[1];
  if (!id) throw new Error(`Could not read a project id out of ${page.url()}`);
  return id;
}

export type NewItem = {
  /** Section to add into; defaults to the first one on the page. */
  section?: string;
  category: string;
  desc: string;
  /** Length, or the plain quantity for units without dimensions. */
  l: number;
  b?: number;
};

/**
 * Add one line item through the entry form, the way the team does it.
 *
 * Closes the form afterwards: it resets to a fresh draft rather than closing,
 * and clicking "Add item" again just toggles it, which would commit that
 * leftover draft as an extra row.
 */
export async function addItem(page: Page, item: NewItem) {
  // Start from a known state. Adding a section auto-opens the entry form on it,
  // pre-filled with the first rate-card item, and that section's button then
  // reads "Close" rather than "Add item" — so without this the next call either
  // misses the button or commits the leftover draft as a stray row.
  await closeEntryForm(page);

  const block = item.section
    ? page.locator(".sec-block", { hasText: item.section }).first()
    : page.locator(".sec-block").first();

  await block.locator('button:has-text("Add item")').click();
  await page.waitForSelector(".entry-form");

  const row = page.locator(".entry-form .item-row").first();
  await row.locator("select").nth(0).selectOption({ label: item.category });
  await page.waitForTimeout(400);
  await row.locator("select").nth(1).selectOption({ label: item.desc });
  await page.waitForTimeout(400);

  const dims = page.locator(".entry-form .item-field.dim input");
  const dimCount = await dims.count();
  const hasBreadth = item.b !== undefined && dimCount > 2;

  await dims.nth(0).fill(String(item.l));
  if (hasBreadth) await dims.nth(1).fill(String(item.b));
  await dims.nth(hasBreadth ? 1 : 0).press("Enter");

  await page.waitForTimeout(1200);
  await page.locator('.entry-form button:has-text("Close")').first().click();
  await page.waitForTimeout(400);
}

/** Wait for the builder's autosave to settle before navigating away. */
export async function waitForSaved(page: Page) {
  await expect(page.locator(".saving-chip")).toHaveText("All changes saved", { timeout: 30_000 });
}

/** Close the entry form if one is open, leaving no half-filled draft behind. */
export async function closeEntryForm(page: Page) {
  if ((await page.locator(".entry-form").count()) === 0) return;
  await page.locator('.entry-form button:has-text("Close")').first().click();
  await page.waitForTimeout(400);
}

export async function addSection(page: Page, room: string) {
  await page.selectOption(".add-section-bar select", { label: room });
  await page.waitForTimeout(1200);
  // The new section opens an entry form of its own; close it so the caller
  // decides what goes in rather than inheriting a default draft.
  await closeEntryForm(page);
}

/** Snapshot the live BOQ as a version and mark it Sent to Client. */
export async function sendToClient(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}/boq`);
  await page.waitForSelector(".sec-block");
  await waitForSaved(page);
  await page.click('button:has-text("Save version & continue to Client View")');
  await page.waitForURL("**/client-view", { timeout: 45_000 });
}

/** Create a client contact and return the share link they'd be sent. */
export async function addClientContact(page: Page, projectId: string, name: string, email: string) {
  await page.goto(`/projects/${projectId}/boq/versions`);
  await page.fill("#cc-name", name);
  await page.fill("#cc-email", email);
  await page.click('button:has-text("Create review link")');
  await expect(page.locator(".share-link input").first()).toBeVisible({ timeout: 30_000 });
  return page.locator(".share-link input").first().inputValue();
}

/**
 * Open a client's share link, answering the email check if it's showing.
 *
 * The check only appears the first time in a given browser — after that the
 * stored pass opens it straight away — so this handles both.
 */
export async function openClientLink(page: Page, url: string, email: string) {
  await page.goto(url);
  await page.waitForTimeout(1500);
  if (await page.locator("#gate-email").count()) {
    await page.fill("#gate-email", email);
    await page.click('button:has-text("Open my estimate")');
  }
  await page.waitForSelector(".cv-row", { timeout: 45_000 });
}

// ------------------------------------------------------------------ numbers

/** "₹1,23,456.78" -> 123456.78. Returns null when there's no number in there. */
export function money(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[₹,\s]/g, "");
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export async function moneyOf(locator: Locator): Promise<number | null> {
  return money(await locator.innerText());
}

// ---------------------------------------------------------------------- PDF

/**
 * Pull the readable text out of one of the app's PDFs, without a PDF library.
 *
 * The exports embed a subsetted DejaVu Sans, so the content streams hold
 * two-byte glyph ids rather than characters. Every embedded font also carries a
 * `/ToUnicode` CMap, which is exactly the glyph -> character table needed to
 * read them back. Streams are uncompressed as jsPDF writes them, with Flate
 * handled anyway in case that changes.
 *
 * The maps for the different faces are merged, and a conflicting code throws
 * rather than silently decoding to the wrong character — better a loud test
 * failure than an assertion that quietly stops meaning anything.
 */
export function pdfText(buffer: Buffer): string {
  const raw = inflateAll(buffer);

  const toUnicode = new Map<string, string>();
  for (const block of raw.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const code = pair[1].toLowerCase();
      const char = String.fromCodePoint(parseInt(pair[2], 16));
      const existing = toUnicode.get(code);
      if (existing !== undefined && existing !== char) {
        throw new Error(
          `PDF has two fonts mapping glyph <${code}> to different characters ` +
            `(${JSON.stringify(existing)} and ${JSON.stringify(char)}). ` +
            `pdfText() merges the ToUnicode maps and can no longer do so safely.`,
        );
      }
      toUnicode.set(code, char);
    }
  }
  for (const block of raw.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const row of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const from = parseInt(row[1], 16);
      const to = parseInt(row[2], 16);
      const start = parseInt(row[3], 16);
      for (let i = 0; i <= to - from; i++) {
        toUnicode.set((from + i).toString(16).padStart(4, "0"), String.fromCodePoint(start + i));
      }
    }
  }

  const decodeHex = (hex: string): string => {
    const clean = hex.replace(/\s+/g, "").toLowerCase();
    let out = "";
    for (let i = 0; i + 3 < clean.length + 1; i += 4) {
      const code = clean.slice(i, i + 4);
      if (code.length < 4) break;
      out += toUnicode.get(code) ?? "";
    }
    return out;
  };

  const pieces: string[] = [];
  // Only inside text objects, so stray hex elsewhere can't leak in.
  for (const textObject of raw.matchAll(/BT([\s\S]*?)ET/g)) {
    const body = textObject[1];
    for (const show of body.matchAll(/<([0-9a-fA-F\s]+)>\s*Tj|\(((?:\\.|[^\\)])*)\)\s*Tj|\[([\s\S]*?)\]\s*TJ/g)) {
      if (show[1] !== undefined) pieces.push(decodeHex(show[1]));
      else if (show[2] !== undefined) pieces.push(unescapePdfString(show[2]));
      else if (show[3] !== undefined) {
        let chunk = "";
        for (const part of show[3].matchAll(/<([0-9a-fA-F\s]+)>|\(((?:\\.|[^\\)])*)\)/g)) {
          chunk += part[1] !== undefined ? decodeHex(part[1]) : unescapePdfString(part[2]);
        }
        pieces.push(chunk);
      }
    }
    pieces.push("\n");
  }

  return pieces.join(" ").replace(/[ \t]+/g, " ").trim();
}

function unescapePdfString(value: string): string {
  return value.replace(/\\([nrtbf()\\])/g, (_, c) =>
    c === "n" ? "\n" : c === "r" ? "\r" : c === "t" ? "\t" : c === "b" ? "\b" : c === "f" ? "\f" : c,
  );
}

function inflateAll(buffer: Buffer): string {
  const latin = buffer.toString("latin1");
  if (!/FlateDecode/.test(latin)) return latin;

  let out = latin;
  const marker = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  const decoded: string[] = [];
  while ((match = marker.exec(latin))) {
    const start = match.index + match[0].length;
    const end = latin.indexOf("endstream", start);
    if (end < 0) continue;
    try {
      decoded.push(zlib.inflateSync(buffer.subarray(start, end)).toString("latin1"));
    } catch {
      // Not a Flate stream — it's already readable in `latin`.
    }
  }
  if (decoded.length > 0) out += "\n" + decoded.join("\n");
  return out;
}

/**
 * The amount printed against a label in a PDF.
 *
 * A label and its figure are separate text objects drawn at different
 * coordinates, so they come out of `pdfText` separated by whitespace, and the
 * figure carries its rupee sign: "Subtotal \n ₹2,000".
 */
export function amountAfter(pdf: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = pdf.match(new RegExp(`${escaped}\\s*₹?\\s*([\\d,]+(?:\\.\\d+)?)`));
  return match ? money(match[1]) : null;
}

/** Click a PDF button and hand back the file's text. */
export async function downloadPdfText(page: Page, buttonText: string): Promise<string> {
  return pdfText(await downloadPdf(page, buttonText));
}

/** Click a PDF button and hand back the raw file. */
export async function downloadPdf(page: Page, buttonText: string): Promise<Buffer> {
  const download = page.waitForEvent("download", { timeout: 60_000 });
  await page.locator(`.topbar-actions button:has-text("${buttonText}")`).first().click();
  const file = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of file) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

// ------------------------------------------------------------ PDF geometry

/** One drawn string, with where it sits and how much room it takes. */
export type PdfRun = {
  page: number;
  text: string;
  /** Left edge, in points from the left of the page. */
  x: number;
  /** Baseline, in points from the bottom of the page. */
  y: number;
  width: number;
  fontSize: number;
};

export type PdfLayout = {
  pageWidth: number;
  pageHeight: number;
  runs: PdfRun[];
};

function bracketBody(source: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === "[") depth++;
    else if (source[i] === "]") {
      depth--;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return "";
}

/**
 * Where every string in a PDF was actually drawn, and how wide it is.
 *
 * Text extraction alone can't see a collision: two strings printed on top of
 * each other read back as two perfectly good strings. This reconstructs the
 * geometry instead — the text matrix gives each run's position, and the
 * embedded font's `/W` array gives the advance width of every glyph in it, so a
 * run's extent is exact rather than estimated.
 *
 * Widths are read per font, never merged across them. Each subset numbers its
 * own glyphs from scratch, so glyph 19 in one face is a different character at a
 * different width in the next; merging them silently mismeasures every run.
 */
export function pdfLayout(buffer: Buffer): PdfLayout {
  const raw = buffer.toString("latin1");

  const objects = new Map<number, string>();
  for (const object of raw.matchAll(/(\d+)\s+0\s+obj\b([\s\S]*?)endobj/g)) {
    objects.set(Number(object[1]), object[2]);
  }

  type Font = { widths: Map<number, number>; defaultWidth: number; toUnicode: Map<number, string> };
  const fonts = new Map<string, Font>();

  for (const dict of raw.matchAll(/\/Font\s*<<([\s\S]*?)>>/g)) {
    for (const entry of dict[1].matchAll(/\/(\w+)\s+(\d+)\s+0\s+R/g)) {
      const body = objects.get(Number(entry[2])) ?? "";

      const descendant = body.match(/\/DescendantFonts\s*\[\s*(\d+)\s+0\s+R/);
      if (!descendant) continue; // A base-14 font — jsPDF registers them but our exports don't draw with them.
      const cid = objects.get(Number(descendant[1])) ?? "";

      const widths = new Map<number, number>();
      const widthArray = cid.match(/\/W\s*\[/);
      if (widthArray) {
        const body2 = bracketBody(cid, widthArray.index! + widthArray[0].length - 1);
        for (const pair of body2.matchAll(/(\d+)\s*\[\s*([\d.]+)\s*\]/g)) {
          widths.set(Number(pair[1]), Number(pair[2]));
        }
        // The other legal form: a first..last range sharing one width.
        for (const span of body2.matchAll(/(\d+)\s+(\d+)\s+([\d.]+)(?=\s|$)/g)) {
          for (let gid = Number(span[1]); gid <= Number(span[2]); gid++) widths.set(gid, Number(span[3]));
        }
      }
      if (widths.size === 0) continue;

      const toUnicode = new Map<number, string>();
      const cmapRef = body.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
      if (cmapRef) {
        const cmap = objects.get(Number(cmapRef[1])) ?? "";
        for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
          for (const pair of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
            toUnicode.set(parseInt(pair[1], 16), String.fromCodePoint(parseInt(pair[2], 16)));
          }
        }
      }

      const dw = cid.match(/\/DW\s+([\d.]+)/);
      fonts.set(entry[1], { widths, defaultWidth: dw ? Number(dw[1]) : 1000, toUnicode });
    }
  }

  const mediaBox = raw.match(/\/MediaBox\s*\[([^\]]*)\]/);
  const box = mediaBox ? mediaBox[1].trim().split(/\s+/).map(Number) : [0, 0, 595.28, 841.89];

  const runs: PdfRun[] = [];
  const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];

  // Streams include embedded font files, so pages are counted only over the
  // ones that actually draw text, in the order jsPDF writes them.
  let page = 0;

  streams.forEach((stream) => {
    const content = stream[1];
    if (!content.includes("BT")) return;
    page++;

    let matrix = [1, 0, 0, 1, 0, 0];
    let lineMatrix = [...matrix];
    let fontSize = 10;
    let leading = 0;
    let fontName = "";

    const token =
      /BT|([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm|([-\d.]+)\s+([-\d.]+)\s+Td|([-\d.]+)\s+([-\d.]+)\s+TD|T\*|\/(\w+)\s+([\d.]+)\s+Tf|([-\d.]+)\s+TL|<([0-9a-fA-F\s]+)>\s*Tj/g;

    for (const match of content.matchAll(token)) {
      const raw2 = match[0];
      if (raw2 === "BT") {
        matrix = [1, 0, 0, 1, 0, 0];
        lineMatrix = [...matrix];
      } else if (raw2.endsWith("Tm")) {
        matrix = [1, 2, 3, 4, 5, 6].map((i) => Number(match[i]));
        lineMatrix = [...matrix];
      } else if (raw2.endsWith("Td")) {
        lineMatrix[4] += Number(match[7]);
        lineMatrix[5] += Number(match[8]);
        matrix = [...lineMatrix];
      } else if (raw2.endsWith("TD")) {
        leading = -Number(match[10]);
        lineMatrix[4] += Number(match[9]);
        lineMatrix[5] += Number(match[10]);
        matrix = [...lineMatrix];
      } else if (raw2 === "T*") {
        lineMatrix[5] -= leading;
        matrix = [...lineMatrix];
      } else if (raw2.endsWith("Tf")) {
        fontName = match[11];
        fontSize = Number(match[12]);
      } else if (raw2.endsWith("TL")) {
        leading = Number(match[13]);
      } else if (match[14] !== undefined) {
        const font = fonts.get(fontName);
        if (!font) continue;
        const hex = match[14].replace(/\s+/g, "");
        let width = 0;
        let text = "";
        for (let i = 0; i + 4 <= hex.length; i += 4) {
          const gid = parseInt(hex.slice(i, i + 4), 16);
          width += font.widths.get(gid) ?? font.defaultWidth;
          text += font.toUnicode.get(gid) ?? "";
        }
        runs.push({
          page,
          text,
          x: matrix[4],
          y: matrix[5],
          width: (width / 1000) * fontSize,
          fontSize,
        });
      }
    }
  });

  return { pageWidth: box[2] - box[0], pageHeight: box[3] - box[1], runs };
}

export type PdfOverlap = {
  page: number;
  y: number;
  left: string;
  right: string;
  /** How far the left run reaches past where the right one starts, in points. */
  by: number;
};

/**
 * Every place two strings sharing a baseline are drawn over each other.
 *
 * A quarter-point of contact is kerning, not a collision, so the tolerance
 * keeps the check on real overlaps.
 */
export function findOverlaps(layout: PdfLayout, tolerance = 0.5): PdfOverlap[] {
  const byLine = new Map<string, PdfRun[]>();
  for (const run of layout.runs) {
    if (!run.text.trim()) continue;
    const key = `${run.page}:${run.y.toFixed(1)}`;
    const list = byLine.get(key) ?? [];
    list.push(run);
    byLine.set(key, list);
  }

  const found: PdfOverlap[] = [];
  for (const line of byLine.values()) {
    const sorted = [...line].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length - 1; i++) {
      const end = sorted[i].x + sorted[i].width;
      if (end > sorted[i + 1].x + tolerance) {
        found.push({
          page: sorted[i].page,
          y: sorted[i].y,
          left: sorted[i].text,
          right: sorted[i + 1].text,
          by: end - sorted[i + 1].x,
        });
      }
    }
  }
  return found;
}

/** Every string drawn outside the page's printable box. */
export function findOutsideMargins(layout: PdfLayout, margin = 40, tolerance = 1): PdfRun[] {
  return layout.runs.filter(
    (run) =>
      run.text.trim() !== "" &&
      (run.x < margin - tolerance || run.x + run.width > layout.pageWidth - margin + tolerance),
  );
}

/** Overlaps and overflows, written out so a failure names the strings involved. */
export function describeLayoutProblems(layout: PdfLayout): string {
  const overlaps = findOverlaps(layout);
  const outside = findOutsideMargins(layout);
  const lines: string[] = [];

  for (const overlap of overlaps) {
    lines.push(
      `overlap on page ${overlap.page}: "${overlap.left.slice(0, 60)}" runs ` +
        `${overlap.by.toFixed(1)}pt into "${overlap.right.slice(0, 40)}"`,
    );
  }
  for (const run of outside) {
    lines.push(
      `outside the margins on page ${run.page}: "${run.text.slice(0, 60)}" spans ` +
        `x=${run.x.toFixed(1)}..${(run.x + run.width).toFixed(1)} of a ${layout.pageWidth.toFixed(0)}pt page`,
    );
  }
  return lines.join("\n");
}
