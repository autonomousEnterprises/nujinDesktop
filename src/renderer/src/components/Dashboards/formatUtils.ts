/**
 * Nujin Dashboard — Number & Value Formatting Utilities
 *
 * Configurable via widget.config:
 *   format:    "currency" | "percent" | "compact" | "number" | "bytes" | "duration" | "auto"
 *   currency:  ISO 4217 code (default "USD")
 *   precision: decimal places (default varies by format)
 *   locale:    BCP 47 locale string (default navigator.language)
 */

export type FormatType = "currency" | "percent" | "compact" | "number" | "bytes" | "duration" | "auto";

export interface FormatOptions {
  format?: FormatType;
  currency?: string;     // ISO 4217: "USD", "EUR", "GBP", "BTC", etc.
  precision?: number;    // decimal places
  locale?: string;       // "en-US", "de-DE", etc.
  prefix?: string;       // custom prefix (e.g. "$", "Ξ")
  suffix?: string;       // custom suffix (e.g. "%", " ms")
}

const DEFAULT_LOCALE = typeof navigator !== "undefined" ? navigator.language : "en-US";

// ── Compact notation (2.4T, 1.2B, 340K) ──────────────────

function formatCompact(value: number, precision = 1, locale = DEFAULT_LOCALE): string {
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(precision)}T`;
  if (Math.abs(value) >= 1e9)  return `${(value / 1e9).toFixed(precision)}B`;
  if (Math.abs(value) >= 1e6)  return `${(value / 1e6).toFixed(precision)}M`;
  if (Math.abs(value) >= 1e3)  return `${(value / 1e3).toFixed(precision)}K`;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  }).format(value);
}

// ── Bytes (1.2 GB, 340 MB) ────────────────────────────────

function formatBytes(value: number, precision = 1): string {
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(Math.abs(value)) / Math.log(1024));
  const idx = Math.min(i, units.length - 1);
  return `${(value / Math.pow(1024, idx)).toFixed(precision)} ${units[idx]}`;
}

// ── Duration (seconds → human readable) ───────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}

// ── Main formatter ────────────────────────────────────────

export function formatValue(value: any, options: FormatOptions = {}): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value !== "number" || isNaN(value)) return String(value);

  const {
    format = "auto",
    currency = "USD",
    precision,
    locale = DEFAULT_LOCALE,
    prefix = "",
    suffix = "",
  } = options;

  let formatted: string;

  switch (format) {
    case "currency": {
      // For crypto symbols that Intl doesn't support
      const cryptoSymbols: Record<string, string> = {
        BTC: "₿", ETH: "Ξ", SOL: "◎", USDT: "$", USDC: "$",
      };
      const sym = cryptoSymbols[currency.toUpperCase()];
      if (sym) {
        formatted = `${sym}${new Intl.NumberFormat(locale, {
          minimumFractionDigits: precision ?? (value >= 100 ? 0 : 2),
          maximumFractionDigits: precision ?? (value >= 100 ? 0 : 2),
        }).format(value)}`;
      } else {
        formatted = new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          minimumFractionDigits: precision ?? (value >= 100 ? 0 : 2),
          maximumFractionDigits: precision ?? (value >= 100 ? 0 : 2),
        }).format(value);
      }
      break;
    }

    case "percent":
      formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: precision ?? 1,
        maximumFractionDigits: precision ?? 2,
      }).format(value) + "%";
      break;

    case "compact":
      formatted = formatCompact(value, precision ?? 1, locale);
      break;

    case "bytes":
      formatted = formatBytes(value, precision ?? 1);
      break;

    case "duration":
      formatted = formatDuration(value);
      break;

    case "number":
      formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: precision ?? 0,
        maximumFractionDigits: precision ?? 2,
      }).format(value);
      break;

    case "auto":
    default:
      formatted = autoFormat(value, locale);
      break;
  }

  return `${prefix}${formatted}${suffix}`;
}

// ── Auto-detection: tries to pick the best format ─────────

function autoFormat(value: number, locale: string): string {
  // Very large numbers → compact
  if (Math.abs(value) >= 1e6) {
    return formatCompact(value, 2, locale);
  }
  // Decimals ≤ 1 look like percentages or ratios
  if (Math.abs(value) <= 100 && value !== Math.floor(value)) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  // Standard number with thousand separators
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// ── Smart column formatter (for tables) ───────────────────
// Infers format from the column name

export function formatCellValue(columnName: string, value: any, widgetConfig?: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value !== "number") return String(value);

  const col = columnName.toLowerCase();
  const cfg = widgetConfig || {};

  // Check for explicit column format overrides
  const colFormats = cfg.columnFormats as Record<string, FormatOptions> | undefined;
  if (colFormats?.[columnName]) {
    return formatValue(value, colFormats[columnName]);
  }

  // Auto-detect from column name
  if (col.includes("price") || col.includes("usd") || col.includes("cost") || col.includes("revenue")) {
    return formatValue(value, { format: "currency", currency: cfg.currency || "USD" });
  }
  if (col.includes("market_cap") || col.includes("tvl") || col.includes("volume")) {
    return formatValue(value, { format: "compact", prefix: "$" });
  }
  if (col.includes("percent") || col.includes("pct") || col.includes("change") || col.includes("share")) {
    return formatValue(value, { format: "percent" });
  }
  if (col.includes("bytes") || col.includes("rss") || col.includes("vms") || col.includes("memory") || col.includes("size")) {
    return formatValue(value, { format: "bytes" });
  }
  if (col.includes("uptime") || col.includes("duration") || col.includes("seconds") || col.includes("elapsed")) {
    return formatValue(value, { format: "duration" });
  }

  // Default: auto format
  return formatValue(value, { format: "auto" });
}

// ── Chart value formatter factory ─────────────────────────

export function createChartFormatter(options: FormatOptions = {}): (value: number) => string {
  return (value: number) => formatValue(value, options);
}
