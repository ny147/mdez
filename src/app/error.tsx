"use client";

import React from "react";

import { RecoveryPage } from "@/components/mdez/RecoveryPage";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <RecoveryPage
      title="Mdez could not open this view"
      description={
        <>
          <p>Your local library stays in this browser. Try opening Mdez again.</p>
          {error.digest ? <p className="mt-3 text-sm">Reference {error.digest}.</p> : null}
        </>
      }
      action={
        <button type="button" className="primary-button px-5 py-3" onClick={reset}>
          Try opening Mdez again
        </button>
      }
    />
  );
}
