"use client";

export function MdezWorkspace() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-abyss text-cream">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(159,234,255,0.24),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(200,168,255,0.18),transparent_24%),radial-gradient(circle_at_50%_95%,rgba(255,128,204,0.16),transparent_30%)]" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-[1800px] items-center justify-center px-5">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ice">Markdown Easy Reader</p>
          <h1 className="mt-3 text-6xl font-black text-bubble drop-shadow-[0_4px_0_rgba(255,255,255,0.95)] md:text-8xl">
            Mdez
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-cream/80">
            Local markdown, cozy folders, lively reading.
          </p>
        </div>
      </section>
    </main>
  );
}
