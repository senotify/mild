"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { clapAction, toggleBookmarkAction, toggleFollowAction } from "@/app/actions";
import { compact } from "@/lib/format";
import { BookmarkIcon, ClapIcon, ResponseIcon, ShareIcon } from "./Icons";

function useSignin() {
  const router = useRouter();
  return () => router.push(`/signup?next=${encodeURIComponent(location.pathname)}`);
}

export function ClapButton({ postId, total, mine, own }: { postId: number; total: number; mine: number; own: boolean }) {
  const [t, setT] = useState(total);
  const [m, setM] = useState(mine);
  const [burst, setBurst] = useState(0);
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signin = useSignin();

  const clap = () => {
    if (own) return;
    if (m + pending.current >= 50) return;
    pending.current++;
    setT((x) => x + 1);
    setBurst((b) => b + 1);
    // Batch rapid clicks into one request, the way holding the button feels.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const n = pending.current;
      pending.current = 0;
      const r = await clapAction(postId, n);
      if ("error" in r) {
        setT((x) => x - n);
        if (r.error === "signin") signin();
      } else {
        setT(r.total);
        setM(r.mine);
      }
      setBurst(0);
    }, 600);
  };

  return (
    <button onClick={clap} disabled={own} className="group flex items-center gap-1 text-muted hover:text-ink disabled:cursor-default relative" aria-label="Clap">
      <ClapIcon filled={m > 0} className={m > 0 ? "text-ink" : ""} />
      <span className="text-[13px]">{t > 0 ? compact(t) : ""}</span>
      {burst > 0 && (
        <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-ink text-bg text-xs rounded-full w-8 h-8 flex items-center justify-center">
          +{Math.min(50, m + burst)}
        </span>
      )}
    </button>
  );
}

export function ResponsesLink({ count }: { count: number }) {
  return (
    <a href="#responses" className="flex items-center gap-1 text-muted hover:text-ink">
      <ResponseIcon />
      <span className="text-[13px]">{count > 0 ? count : ""}</span>
    </a>
  );
}

export function BookmarkButton({ postId, saved }: { postId: number; saved: boolean }) {
  const [s, setS] = useState(saved);
  const [, start] = useTransition();
  const signin = useSignin();
  return (
    <button
      aria-label={s ? "Remove from library" : "Save to library"}
      className="text-muted hover:text-ink"
      onClick={() =>
        start(async () => {
          setS(!s);
          const r = await toggleBookmarkAction(postId);
          if ("error" in r) { setS(s); if (r.error === "signin") signin(); }
          else setS(r.saved);
        })
      }
    >
      <BookmarkIcon filled={s} className={s ? "text-ink" : ""} />
    </button>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      aria-label="Share"
      className="text-muted hover:text-ink relative"
      onClick={async () => {
        const url = location.href;
        if (navigator.share) {
          try { await navigator.share({ title, url }); } catch {}
          return;
        }
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <ShareIcon />
      {copied && <span className="absolute top-8 right-0 whitespace-nowrap bg-ink text-bg text-xs rounded px-2 py-1">Link copied</span>}
    </button>
  );
}

export function FollowButton({ username, following, small }: { username: string; following: boolean; small?: boolean }) {
  const [f, setF] = useState(following);
  const [, start] = useTransition();
  const signin = useSignin();
  const base = small ? "text-sm px-3 py-1" : "text-sm px-4 py-2";
  return (
    <button
      className={`${base} rounded-full ${f ? "border border-ink text-ink" : "bg-ink text-bg hover:opacity-85"}`}
      onClick={() =>
        start(async () => {
          setF(!f);
          const r = await toggleFollowAction(username);
          if ("error" in r) { setF(f); if (r.error === "signin") signin(); }
          else setF(r.following);
        })
      }
    >
      {f ? "Following" : "Follow"}
    </button>
  );
}
