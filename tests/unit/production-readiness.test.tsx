import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ErrorPage from "@/app/error";
import { appMetadata } from "@/app/metadata";
import manifest from "@/app/manifest";
import NotFound from "@/app/not-found";
import { maxDuration } from "@/app/api/github/archive/route";
import { EditorToolbar } from "@/components/mdez/EditorToolbar";
import { EditorPane } from "@/components/mdez/EditorPane";
import nextConfig from "../../next.config";

const mockedEditor = vi.hoisted(() => ({
  view: {
    state: {
      selection: { main: { from: 0, to: 12 } },
      sliceDoc: () => "first\nsecond",
      doc: { lineAt: () => ({ from: 0, to: 12, text: "first\nsecond" }) }
    },
    dispatch: vi.fn(),
    focus: vi.fn()
  }
}));

vi.mock("@uiw/react-codemirror", async () => {
  const React = await import("react");

  return {
    default: React.forwardRef(function MockCodeMirror(_props, ref) {
      React.useImperativeHandle(ref, () => ({ view: mockedEditor.view }));
      return <div data-testid="markdown-editor" />;
    })
  };
});

describe("production readiness", () => {
  it("publishes app metadata, a manifest, and a local icon", () => {
    expect(appMetadata).toMatchObject({
      applicationName: "Mdez",
      title: { default: "Mdez", template: "%s · Mdez" },
      icons: { icon: "/icon.svg" }
    });
    expect(manifest()).toMatchObject({
      name: "Mdez",
      short_name: "Mdez",
      display: "standalone",
      start_url: "/"
    });
    expect(readFileSync(resolve(process.cwd(), "src/app/icon.svg"), "utf8")).toContain("<svg");
  });

  it("provides recovery actions for application and missing-route errors", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Try opening Mdez again" }));
    expect(reset).toHaveBeenCalledOnce();

    render(<NotFound />);
    expect(screen.getByRole("link", { name: "Return to Library" })).toHaveAttribute("href", "/");
  });

  it("sets safe browser headers and a hosting duration above the route timeout", async () => {
    expect(maxDuration).toBe(20);
    const rules = await nextConfig.headers?.();
    const rootRule = rules?.find((rule) => rule.source === "/:path*");
    const headers = Object.fromEntries(rootRule?.headers.map((header) => [header.key, header.value]) ?? []);

    expect(headers).toMatchObject({
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY"
    });
  });

  it("keeps the drawer close control available through the tablet breakpoint", () => {
    const sidebarSource = readFileSync(resolve(process.cwd(), "src/components/mdez/Sidebar.tsx"), "utf8");

    expect(sidebarSource).toContain('className="flex items-center justify-between gap-3 lg:hidden"');
    expect(sidebarSource).not.toContain('className="flex items-center justify-between gap-3 md:hidden"');
  });
  it("routes sidebar renames through the document draft title queue", () => {
    const workspaceSource = readFileSync(resolve(process.cwd(), "src/components/mdez/MdezWorkspace.tsx"), "utf8");

    expect(workspaceSource).toContain("renameTitleById: renameDraftTitle");
    expect(workspaceSource).toContain("await renameDraftTitle(documentId, title)");
    expect(workspaceSource).not.toContain("const updated = await renameDocument(documentId, title)");
    expect(workspaceSource).toContain('setError("Could not rename page.")');
  });

  it("composes repository-backed library orchestration through a named controller", () => {
    const workspaceSource = readFileSync(resolve(process.cwd(), "src/components/mdez/MdezWorkspace.tsx"), "utf8");

    expect(workspaceSource).toContain("const localLibrary = useWorkspaceLibrary();");
    expect(workspaceSource).toContain("const groupLibrary = useKeyGroupLibrary(activeGroupId);");
    expect(workspaceSource).toContain("const library = activeGroupId ? groupLibrary : localLibrary;");
    expect(workspaceSource).not.toMatch(/\b(?:createDocument|createDocuments|createFolder|deleteDocument|deleteFolder|importGitHubSource|listContent|moveDocument|refreshGitHubSource|renameFolder)\b/);
    expect(workspaceSource).not.toContain("from \"@/lib/tree\"");
  });

  it("uses one canonical workspace token vocabulary", () => {
    const tokenSource = readFileSync(resolve(process.cwd(), "src/app/styles/tokens.css"), "utf8");
    const consumerSource = [
      "src/app/styles/workspace.css",
      "src/app/styles/markdown.css",
      "src/components/mdez/MdezWorkspace.tsx",
      "src/components/mdez/Sidebar.tsx",
      "src/components/mdez/PreviewPane.tsx",
      "src/components/mdez/EditorPane.tsx",
      "src/components/mdez/ShelfPane.tsx",
      "tailwind.config.ts"
    ].map((path) => readFileSync(resolve(process.cwd(), path), "utf8")).join("\n");
    const legacyTokens = /--(?:bg|panel|surface(?:-2)?|fg|muted|border|accent(?:-read|-files|-on)?|font-body|radius-sm|radius-md)\b/;

    expect(tokenSource).not.toMatch(legacyTokens);
    expect(consumerSource).not.toMatch(legacyTokens);
    expect(consumerSource).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
    expect(tokenSource.match(/:root\s*\{/g)).toHaveLength(1);
  });

  it("keeps document scrolling available outside the fixed workspace shell", () => {
    const workspaceCss = readFileSync(resolve(process.cwd(), "src/app/styles/workspace.css"), "utf8");

    expect(workspaceCss).not.toMatch(/body\s*\{[^}]*overflow:\s*hidden/);
    expect(workspaceCss).toMatch(/\.workspace-shell\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden;/);
  });

  it("decomposes the import dialog into a shell and source panels", () => {
    const importDialogSource = readFileSync(resolve(process.cwd(), "src/components/mdez/ImportDialog.tsx"), "utf8");

    for (const component of ["ImportDialogShell", "PasteImportPanel", "FileImportPanel", "GitHubImportPanel"]) {
      expect(importDialogSource).toContain(component);
    }

    for (const panel of ["PasteImportPanel.tsx", "FileImportPanel.tsx", "GitHubImportPanel.tsx"]) {
      const panelSource = readFileSync(resolve(process.cwd(), "src/components/mdez/import", panel), "utf8");
      expect(panelSource).not.toContain("@/lib/repository");
    }
  });

  it("keeps formatting and document actions working in EditorToolbar", () => {
    const onFormat = vi.fn();
    const onQuickShare = vi.fn();
    render(
      <EditorToolbar
        onFormat={onFormat}
        onQuickShare={onQuickShare}
        documentActions={<button type="button">Export .md</button>}
      />
    );

    const formattingActions = [
      "Bold", "Italic", "Insert link", "Insert image", "Inline code",
      "Code block", "Math", "Heading 1", "Heading 2", "Divider"
    ];

    for (const action of formattingActions) {
      expect(screen.getByRole("button", { name: action })).toBeVisible();
    }

    expect(screen.queryByRole("button", { name: "More formatting" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Inline code" }));
    fireEvent.click(screen.getByRole("button", { name: "Quick Share" }));
    expect(onFormat).toHaveBeenCalledWith("inlineCode");
    expect(onQuickShare).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Export .md" })).toBeVisible();
  });

  it("inserts a fenced code block from the explicit Code block control", () => {
    mockedEditor.view.dispatch.mockClear();
    render(
      <EditorPane
        document={{
          id: "document-1",
          title: "Example",
          body: "first\nsecond",
          folderId: null,
          order: 0,
          createdAt: "2026-08-27T00:00:00.000Z",
          updatedAt: "2026-08-27T00:00:00.000Z"
        }}
        title="Example"
        body="first\nsecond"
        saveStatus="Saved"
        viewMode="editor"
        onCreateDocument={vi.fn()}
        onOpenImport={vi.fn()}
        onQuickShare={vi.fn()}
        onViewModeChange={vi.fn()}
        onBodyChange={vi.fn()}
        onRename={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Code block" }));

    expect(mockedEditor.view.dispatch).toHaveBeenCalledWith({
      changes: { from: 0, to: 12, insert: "\n```text\nfirst\nsecond\n```\n" },
      selection: { anchor: 26 }
    });
  });

  it("keeps editor, reader, and import features behind dynamic boundaries", () => {
    const workspace = readFileSync(resolve(process.cwd(), "src/components/mdez/MdezWorkspace.tsx"), "utf8");
    expect(workspace).toMatch(/dynamic\(\s*\(\) => import\("@\/components\/mdez\/EditorPane"\)/);
    expect(workspace).toMatch(/dynamic\(\s*\(\) => import\("@\/components\/mdez\/PreviewPane"\)/);
    expect(workspace).toMatch(/dynamic\(\s*\(\) => import\("@\/components\/mdez\/ImportDialog"\)/);
  });
});
