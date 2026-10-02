export function money(amount: number, currency = "USD") {
  const n = Math.round((amount + Number.EPSILON) * 100) / 100;
  const symbols: Record<string, string> = { USD: "$", AED: "AED ", SAR: "SAR ", EUR: "€", GBP: "£" };
  const sym = symbols[currency] ?? currency + " ";
  return `${sym}${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

export function minToLabel(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h < 12 ? "AM" : "PM";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${mm.toString().padStart(2, "0")} ${ampm}`;
}

export function dateLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function dayNum(iso: string) {
  return new Date(iso + "T00:00:00").getDate();
}
export function weekdayShort(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });
}

export function nextDays(count: number): string[] {
  const out: string[] = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export const statusColorKey = (status: string): string => {
  const map: Record<string, string> = {
    CONFIRMED: "success", COMPLETED: "info", PENDING: "warning",
    CANCELLED: "error", REJECTED: "error", NO_SHOW: "muted", EXPIRED: "muted",
    VERIFIED: "success", PENDING_REVIEW: "warning", DRAFT: "muted", SUSPENDED: "error",
    PAID: "success", REFUNDED: "info", PARTIALLY_REFUNDED: "info", FAILED: "error",
  };
  return map[status] ?? "muted";
};

export function prettyStatus(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
