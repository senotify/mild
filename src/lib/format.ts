const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Always "DD Mon YYYY" in Jakarta time, e.g. "06 Nov 2026". Fixed month names,
 *  because ICU's en-GB data spells September "Sept". */
export function fmtDate(unix: number | null | undefined, _withYear?: boolean) {
  if (!unix) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).formatToParts(new Date(unix * 1000));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${MONTHS[Number(get("month")) - 1]} ${get("year")}`;
}

export function compact(n: number) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export const SITE_URL = (process.env.SITE_URL || "https://mild.senotify.com").replace(/\/$/, "");
export const SITE_NAME = "Mild";
export const SITE_TAGLINE = "Ideas worth slowing down for";
