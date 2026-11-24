"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/actions";

export function UserMenu({ username, name, isAdmin, children }: { username: string; name: string; isAdmin: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const item = "block px-6 py-2 text-sm text-muted hover:text-ink";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Account menu" className="flex">
        {children}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded shadow-[0_2px_10px_rgba(0,0,0,0.15)] py-4 z-40">
          <Link href={`/@${username}`} className="px-6 pb-3 mb-2 border-b border-line block" onClick={() => setOpen(false)}>
            <div className="text-sm font-medium text-ink">{name}</div>
            <div className="text-sm text-muted">View profile</div>
          </Link>
          <Link href="/new-story" className={`${item} sm:hidden`} onClick={() => setOpen(false)}>Write</Link>
          <Link href="/me/library" className={item} onClick={() => setOpen(false)}>Library</Link>
          <Link href="/me/stories" className={item} onClick={() => setOpen(false)}>Stories</Link>
          <Link href="/me/settings" className={item} onClick={() => setOpen(false)}>Settings</Link>
          {isAdmin && <Link href="/admin" className={item} onClick={() => setOpen(false)}>Admin</Link>}
          <form action={logoutAction} className="border-t border-line mt-2 pt-2">
            <button className={`${item} w-full text-left`}>Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
