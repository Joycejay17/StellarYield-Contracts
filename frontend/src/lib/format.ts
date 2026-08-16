/** Amount + time formatting helpers shared across the UI. */

/** Format a raw integer amount (smallest unit) for display. */
export function formatAmount(
  raw: bigint | undefined,
  decimals: number,
  opts: { maxFractionDigits?: number } = {},
): string {
  if (raw === undefined) return "—";
  const maxFrac = opts.maxFractionDigits ?? 2;
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;

  const wholeStr = whole.toLocaleString("en-US");
  if (maxFrac === 0 || frac === 0n) return `${negative ? "-" : ""}${wholeStr}`;

  const fracStr = frac
    .toString()
    .padStart(decimals, "0")
    .slice(0, maxFrac)
    .replace(/0+$/, "");
  return fracStr
    ? `${negative ? "-" : ""}${wholeStr}.${fracStr}`
    : `${negative ? "-" : ""}${wholeStr}`;
}

/**
 * Parse a user-typed decimal string into a raw integer amount.
 * Throws on malformed input or on more precision than the asset supports.
 */
export function parseAmount(input: string, decimals: number): bigint {
  const trimmed = input.trim().replace(/,/g, "");
  if (!trimmed) throw new Error("Enter an amount");
  if (!/^\d*\.?\d*$/.test(trimmed)) throw new Error("Amount must be a number");

  const [whole = "", frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`At most ${decimals} decimal places`);
  }
  const padded = frac.padEnd(decimals, "0");
  const value = BigInt(`${whole || "0"}${padded}`);
  if (value <= 0n) throw new Error("Amount must be greater than zero");
  return value;
}

/** Shorten a Stellar/contract address for display: GABC…WXYZ */
export function shortAddress(addr: string, lead = 4, tail = 4): string {
  if (addr.length <= lead + tail + 1) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

/** Basis points → percentage string, e.g. 250 → "2.5%" */
export function formatBps(bps: number | undefined): string {
  if (bps === undefined) return "—";
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

/** Unix seconds → "12 Mar 2027" */
export function formatDate(timestamp: bigint | undefined): string {
  if (timestamp === undefined || timestamp === 0n) return "—";
  return new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Seconds remaining → "142 days" / "6 hours" / "Matured" */
export function formatDuration(seconds: bigint | undefined): string {
  if (seconds === undefined) return "—";
  if (seconds === 0n) return "Matured";
  const s = Number(seconds);
  const days = Math.floor(s / 86_400);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(s / 3_600);
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const mins = Math.max(1, Math.floor(s / 60));
  return `${mins} min${mins === 1 ? "" : "s"}`;
}

/**
 * `share_price` is scaled by `10^share_decimals`. Render it as a plain
 * multiplier, e.g. 1_035_000 at 6 decimals → "1.0350".
 */
export function formatSharePrice(
  raw: bigint | undefined,
  shareDecimals: number,
): string {
  if (raw === undefined) return "—";
  return (Number(raw) / 10 ** shareDecimals).toFixed(4);
}
