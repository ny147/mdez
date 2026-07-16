"use client";

import React from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-2 px-5 py-12 text-ink">
      <section className="w-full max-w-lg rounded-lg border border-border bg-surface p-8 text-center shadow-panel">
        <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-accent-files">
          Workspace interrupted
        </p>
        <h1 className="mt-3 font-display text-3xl font-black">Mdez could not open this view</h1>
        <p className="mt-3 leading-7 text-muted">
          Your local library stays in this browser. Try loading the workspace again.
          {error.digest ? ` Reference ${error.digest}.` : ""}
        </p>
        <button type="button" className="primary-button mt-6 px-5 py-3" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
