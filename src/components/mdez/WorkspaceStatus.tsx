"use client";

type WorkspaceStatusProps = {
  message: string;
  state: "saved" | "saving" | "loading" | "error";
  activePage: string;
  isInert?: boolean;
};

export function WorkspaceStatus({ message, state, activePage, isInert = false }: WorkspaceStatusProps) {
  return (
    <footer className="workspace-status" aria-label="Workspace status" inert={isInert}>
      <div className="status-cluster">
        <span className={`status-dot status-dot-${state}`} aria-hidden="true" />
        <span role="status" aria-live="polite">{message}</span>
      </div>
      <span className="status-page" title={activePage}>{activePage}</span>
      <div className="status-cluster status-meta" aria-label="Local UTF-8 document">
        <span>UTF-8</span>
        <span className="local-badge">Local</span>
      </div>
    </footer>
  );
}
