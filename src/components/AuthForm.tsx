"use client";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction, signupAction, type FormState } from "@/app/actions";

const input = "w-full border-b border-line-strong focus:border-ink outline-none py-2 text-base text-ink bg-transparent";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? loginAction : signupAction, undefined);
  const q = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="max-w-[420px] mx-auto px-6 py-16 text-center">
      <h1 className="font-serif text-[28px] text-ink">{mode === "login" ? "Welcome back." : "Join Mild."}</h1>
      <form action={action} className="mt-12 text-left space-y-6">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <>
            <label className="block text-sm text-muted">
              Your name
              <input name="name" required maxLength={60} autoComplete="name" className={input} />
            </label>
            <label className="block text-sm text-muted">
              Username
              <input name="username" required pattern="[a-zA-Z0-9_]{3,24}" title="3-24 letters, numbers or underscores" autoComplete="username" className={input} />
            </label>
          </>
        )}
        <label className="block text-sm text-muted">
          {mode === "login" ? "Email or username" : "Email"}
          <input name="email" type={mode === "login" ? "text" : "email"} required autoComplete={mode === "login" ? "username" : "email"} className={input} />
        </label>
        <label className="block text-sm text-muted">
          Password
          <input name="password" type="password" required minLength={mode === "signup" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} className={input} />
        </label>
        {mode === "signup" && (
          // Honeypot for bots; hidden from people and assistive tech.
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        )}
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <button disabled={pending} className="w-full bg-ink text-bg rounded-full py-2.5 hover:opacity-85 disabled:opacity-50">
          {pending ? "One moment..." : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="mt-10 text-sm text-ink">
        {mode === "login" ? (
          <>No account? <Link href={`/signup${q}`} className="text-accent font-bold">Create one</Link></>
        ) : (
          <>Already have an account? <Link href={`/login${q}`} className="text-accent font-bold">Sign in</Link></>
        )}
      </p>
    </div>
  );
}
