"use client";

import { RefreshCw } from "lucide-react";

import type { GitHubSource } from "@/types/github";

type GitHubSourcePanelProps = {
  source: GitHubSource;
  isRefreshing: boolean;
  onRefresh: (source: GitHubSource) => void;
};

function formatRefreshTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Refresh time unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function GitHubSourcePanel({ source, isRefreshing, onRefresh }: GitHubSourcePanelProps) {
  return (
    <section className="rounded-md border border-border bg-surface p-3" aria-labelledby="github-source-title">
      <div className="min-w-0">
        <h2 id="github-source-title" className="truncate text-sm font-extrabold text-ink">
          {source.repository}
        </h2>
        <p className="mt-1 truncate text-xs font-bold text-accent-read">
          Public GitHub {"\u00b7"} {source.branch}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted">
          Last refreshed{" "}
          <time dateTime={source.lastRefreshedAt}>{formatRefreshTime(source.lastRefreshedAt)}</time>
        </p>
      </div>
      <button
        type="button"
        onClick={() => onRefresh(source)}
        disabled={isRefreshing}
        className="secondary-button mt-3 w-full px-3 py-2 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-55"
      >
        <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        {isRefreshing ? "Refreshing from GitHub..." : "Refresh from GitHub"}
      </button>
    </section>
  );
}
