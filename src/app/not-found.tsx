import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-2 px-5 py-12 text-ink">
      <section className="w-full max-w-lg rounded-lg border border-border bg-surface p-8 text-center shadow-panel">
        <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-accent-files">Page not found</p>
        <h1 className="mt-3 font-display text-3xl font-black">This shelf does not exist</h1>
        <p className="mt-3 leading-7 text-muted">Return to the workspace and keep reading or writing locally.</p>
        <Link href="/" className="primary-button mt-6 inline-flex px-5 py-3">
          Return to Mdez
        </Link>
      </section>
    </main>
  );
}
