import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/posts";
import { SITE_NAME, SITE_URL, fmtDate } from "@/lib/format";

// better-sqlite3 needs Node, not the edge runtime.
export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };

/**
 * The share card for a story: what LinkedIn, X, Slack and Google show when a post is linked.
 * Posts with their own cover use that instead (see postImage); this is the fallback for the rest.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPostBySlug(slug);
  if (!p || p.status !== "published") return new Response("Not found", { status: 404 });

  const title = p.title.length > 110 ? `${p.title.slice(0, 107)}…` : p.title;
  const subtitle = p.subtitle.length > 150 ? `${p.subtitle.slice(0, 147)}…` : p.subtitle;
  const host = new URL(SITE_URL).host;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#ffffff",
          color: "#191919",
          borderTop: "14px solid #1a8917",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 700 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#191919",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
            }}
          >
            M
          </div>
          {SITE_NAME}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: title.length > 60 ? 58 : 68, fontWeight: 800, lineHeight: 1.12, letterSpacing: -1.5 }}>
            {title}
          </div>
          {subtitle && <div style={{ fontSize: 30, lineHeight: 1.35, color: "#555555" }}>{subtitle}</div>}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26, color: "#6b6b6b" }}>
          <div style={{ display: "flex", gap: 14 }}>
            <span style={{ color: "#191919", fontWeight: 700 }}>{p.author_name}</span>
            <span>·</span>
            <span>{fmtDate(p.published_at)}</span>
            <span>·</span>
            <span>{p.reading_minutes} min read</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {p.tags.slice(0, 3).map((t) => (
              <span key={t} style={{ background: "#f2f2f2", borderRadius: 999, padding: "6px 18px", fontSize: 22, color: "#444444" }}>
                {t}
              </span>
            ))}
            <span style={{ marginLeft: 8 }}>{host}</span>
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: {
        // Titles can be edited, so cache for a day rather than forever.
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    },
  );
}
