import React, { type ReactNode } from "react";

type RecoveryPageProps = {
  title: string;
  description: ReactNode;
  action: ReactNode;
};

export function RecoveryPage({ title, description, action }: RecoveryPageProps) {
  return (
    <main className="recovery-page text-ink">
      <section className="recovery-content" aria-labelledby="recovery-title">
        <p className="font-display text-base font-bold text-accent-files">Mdez</p>
        <h1 id="recovery-title" className="mt-5 max-w-xl font-display text-3xl font-black leading-tight sm:text-4xl">
          {title}
        </h1>
        <div className="mt-4 max-w-xl text-base leading-7 text-muted">{description}</div>
        <div className="mt-7 flex flex-wrap gap-3">{action}</div>
      </section>
    </main>
  );
}
