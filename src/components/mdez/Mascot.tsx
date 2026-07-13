export function Mascot({ label = "Mdez mascot" }: { label?: string }) {
  return (
    <div
      aria-label={label}
      role="img"
      className="relative mx-auto h-24 w-24 rounded-md border border-border bg-surface p-2 shadow-soft"
    >
      <div className="relative h-full w-full rounded bg-panel">
        <span className="absolute left-1/2 top-2 h-16 w-11 -translate-x-1/2 rounded-sm border border-accent-files/35 bg-surface shadow-soft" />
        <span className="absolute left-[1.6rem] top-4 h-10 w-3 rounded-sm bg-accent-files/85" />
        <span className="absolute left-[2.25rem] top-3 h-12 w-3 rounded-sm bg-accent/80" />
        <span className="absolute left-[2.9rem] top-5 h-9 w-3 rounded-sm bg-accent-read/75" />
        <div className="absolute bottom-3 left-1/2 h-8 w-14 -translate-x-1/2 rounded-t-full border border-border bg-surface">
          <span className="absolute left-3 top-3 h-1.5 w-1.5 rounded-full bg-ink" />
          <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-ink" />
          <span className="absolute left-1/2 top-5 h-1 w-5 -translate-x-1/2 rounded-full bg-accent-files/70" />
        </div>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-sm border border-border bg-surface px-2 py-0.5 font-mono text-[0.55rem] font-black leading-none text-muted">
          LOCAL
        </span>
      </div>
    </div>
  );
}
