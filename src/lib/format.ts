export function fmtDate(unix: number | null | undefined, withYear?: boolean) {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear || !sameYear ? { year: "numeric" } : {}),
    timeZone: "Asia/Jakarta",
  });
}

export function compact(n: number) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export const SITE_URL = (process.env.SITE_URL || "https://mild.senotify.com").replace(/\/$/, "");
export const SITE_NAME = "Mild";
export const SITE_TAGLINE = "Ideas worth slowing down for";
