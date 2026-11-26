import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <Link href="/" className="text-ink"><Logo /></Link>
      <p className="mt-16 text-muted text-sm tracking-widest">PAGE NOT FOUND</p>
      <h1 className="mt-4 font-serif text-[64px] sm:text-[96px] leading-none text-ink">404</h1>
      <p className="mt-6 text-ink">Out of nothing, something. This page isn&apos;t here, though.</p>
      <Link href="/" className="mt-8 bg-ink text-bg rounded-full px-5 py-2 text-sm">Home</Link>
    </main>
  );
}
