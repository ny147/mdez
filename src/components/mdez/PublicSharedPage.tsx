"use client";

import React, { useEffect, useState } from "react";

import { MarkdownReader } from "@/components/mdez/MarkdownReader";
import type { QuickSharePayload } from "@/types/quick-share";

type SharedPageState =
  | { status: "loading" }
  | { status: "ready"; payload: QuickSharePayload }
  | { status: "not-found" }
  | { status: "expired" }
  | { status: "error" };

function expiryText(expiresAt: string | null) {
  if (!expiresAt) return "This snapshot does not expire.";
  return `Available until ${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(expiresAt))}.`;
}

function TerminalState({ title, message }: { title: string; message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-12 text-ink">
      <div className="w-full max-w-xl border-t border-border pt-8">
        <p className="field-label">Mdez shared snapshot</p>
        <h1 className="mt-2 text-wrap-balance font-display text-3xl font-black">{title}</h1>
        <p className="mt-4 max-w-prose text-pretty text-base font-semibold leading-7 text-muted">{message}</p>
        <a href="/" className="secondary-button mt-6 min-h-11 px-4 py-2 text-sm font-extrabold">
          Open Mdez
        </a>
      </div>
    </main>
  );
}

export function PublicSharedPage({ publicId }: { publicId: string }) {
  const [state, setState] = useState<SharedPageState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void fetch(`/api/quick-shares/${encodeURIComponent(publicId)}`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        if (response.status === 404) return setState({ status: "not-found" });
        if (response.status === 410) return setState({ status: "expired" });
        if (!response.ok) return setState({ status: "error" });
        const payload = await response.json() as QuickSharePayload;
        setState({ status: "ready", payload });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error" });
      });
    return () => controller.abort();
  }, [publicId]);

  if (state.status === "not-found") {
    return <TerminalState title="Shared page not found" message="This link does not point to an available snapshot." />;
  }
  if (state.status === "expired") {
    return <TerminalState title="This shared page has expired" message="Its creator chose a limited availability window." />;
  }
  if (state.status === "error") {
    return <TerminalState title="Could not load this shared page" message="Try opening the link again in a moment." />;
  }
  if (state.status === "loading") {
    return (
      <main className="min-h-screen bg-canvas px-5 py-10 text-ink">
        <div className="shared-page-loading mx-auto w-full max-w-[760px] animate-pulse" role="status">
          <span className="sr-only">Loading shared page...</span>
          <div className="h-4 w-28 rounded bg-panel" />
          <div className="mt-8 h-10 w-2/3 rounded bg-panel" />
          <div className="mt-8 grid gap-3">
            <div className="h-4 rounded bg-panel" />
            <div className="h-4 w-5/6 rounded bg-panel" />
            <div className="h-4 w-3/4 rounded bg-panel" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-border bg-paper px-5 py-3">
        <div className="mx-auto flex w-full max-w-[760px] flex-wrap items-center justify-between gap-2">
          <a href="/" className="font-display text-base font-black text-ink">Mdez</a>
          <p className="text-sm font-semibold text-muted">View-only snapshot</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[760px] px-5 py-8 sm:py-12">
        <p className="mb-8 border-b border-border pb-4 text-sm font-semibold text-muted">
          {expiryText(state.payload.expiresAt)}
        </p>
        <MarkdownReader title={state.payload.title} markdown={state.payload.markdown} />
      </main>
    </div>
  );
}
