export function Logo({ className = "" }: { className?: string }) {
  // Mild's own mark: a half-filled circle (a "mild" temperature) beside a serif wordmark.
  return (
    <span className={`inline-flex items-center gap-2 select-none ${className}`}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <circle cx="13" cy="13" r="11.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <path d="M13 1.5a11.5 11.5 0 0 1 0 23z" fill="currentColor" />
      </svg>
      <span className="font-serif text-[27px] font-bold tracking-tight leading-none">Mild</span>
    </span>
  );
}
