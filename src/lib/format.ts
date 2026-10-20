/**
 * The one place every displayed number and date is formatted (UI spec section 7).
 *
 * Money arrives as a decimal string ("1234567.50"), the way it leaves a
 * Decimal(14,2) column. Nothing here turns it into a JS number: the digits are
 * grouped and spelled out as text, so a large or long amount can't pick up a
 * floating-point error on its way to the screen.
 */

const TZ = "Asia/Kolkata";

type ParsedAmount = { negative: boolean; rupees: string; paise: string };

/** "-1234567.5" -> { negative: true, rupees: "1234567", paise: "50" }. Paise are rounded half up to 2 digits. */
function parseAmount(amount: string): ParsedAmount {
  const trimmed = amount.trim();
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(trimmed);
  if (!match || (match[2] === "" && (match[3] ?? "") === "")) {
    throw new Error(`Not an amount: "${amount}"`);
  }
  const negative = match[1] === "-";
  let rupees = (match[2] || "0").replace(/^0+(?=\d)/, "");
  const fraction = (match[3] ?? "").padEnd(3, "0");
  let paise = Number.parseInt(fraction.slice(0, 2), 10);
  if (Number.parseInt(fraction[2], 10) >= 5) paise += 1;
  if (paise === 100) {
    paise = 0;
    rupees = addOne(rupees);
  }
  const isZero = /^0+$/.test(rupees) && paise === 0;
  return { negative: negative && !isZero, rupees, paise: String(paise).padStart(2, "0") };
}

/** Add one to a string of digits without converting it to a number. */
function addOne(digits: string): string {
  const out = digits.split("");
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] === "9") {
      out[i] = "0";
    } else {
      out[i] = String(Number(out[i]) + 1);
      return out.join("");
    }
  }
  return "1" + out.join("");
}

/** Indian grouping: the last three digits, then pairs. "1234567" -> "12,34,567". */
function groupIndian(rupees: string): string {
  if (rupees.length <= 3) return rupees;
  const last3 = rupees.slice(-3);
  const rest = rupees.slice(0, -3);
  const pairs = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${pairs},${last3}`;
}

/**
 * ₹12,34,567 (or ₹12,34,567.50 with `paise`). Display only; never do maths on the result.
 * Without `paise`, the amount is rounded half up to the rupee.
 */
export function formatINR(amount: string, opts: { paise?: boolean } = {}): string {
  const parsed = parseAmount(amount);
  let { rupees } = parsed;
  if (!opts.paise && Number(parsed.paise) >= 50) rupees = addOne(rupees);
  const body = opts.paise ? `${groupIndian(rupees)}.${parsed.paise}` : groupIndian(rupees);
  const showsZero = /^[0,.]+$/.test(body);
  return `${parsed.negative && !showsZero ? "-" : ""}₹${body}`;
}

/** 08 Oct 2026, in India time. */
export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  }).format(d);
}

/** 2:05 pm, in India time. */
export function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  }).format(d);
}

/** "just now", "12 min ago", "2 h ago" under 24 hours, then the date. */
export function formatRelative(d: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDate(d);
}

const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 0 to 99 in words. */
function underHundred(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  return n % 10 ? `${tens} ${ONES[n % 10]}` : tens;
}

/** 0 to 999 in words. */
function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest) parts.push(underHundred(rest));
  return parts.join(" ");
}

/** A string of digits in Indian words: crore, lakh, thousand, hundred. */
function digitsInWords(digits: string): string {
  const clean = digits.replace(/^0+/, "");
  if (clean === "") return "zero";
  // Above 99 crore, the crore count is itself said in lakh and thousand ("one hundred crore").
  if (clean.length > 9) {
    const crores = digitsInWords(clean.slice(0, -7));
    const rest = clean.slice(-7).replace(/^0+/, "");
    return rest ? `${crores} crore ${digitsInWords(rest)}` : `${crores} crore`;
  }
  const n = Number(clean); // at most 9 digits here, so exact
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${underHundred(crore)} crore`);
  if (lakh) parts.push(`${underHundred(lakh)} lakh`);
  if (thousand) parts.push(`${underHundred(thousand)} thousand`);
  if (rest) parts.push(underThousand(rest));
  return parts.join(" ");
}

/**
 * Amount in Indian words: "Two lakh forty thousand rupees",
 * "One thousand eight hundred sixty rupees and fifty paise".
 */
export function amountInWords(amount: string): string {
  const { negative, rupees, paise } = parseAmount(amount);
  const paiseNumber = Number(paise);
  let words = `${digitsInWords(rupees)} ${rupees === "1" ? "rupee" : "rupees"}`;
  if (paiseNumber > 0) words += ` and ${underHundred(paiseNumber)} paise`;
  if (negative) words = `minus ${words}`;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
