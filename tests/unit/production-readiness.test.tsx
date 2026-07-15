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
import nextConfig from "../../next.config";

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

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();

    render(<NotFound />);
    expect(screen.getByRole("link", { name: "Return to Mdez" })).toHaveAttribute("href", "/");
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

    expect(workspaceSource).toContain("const library = useWorkspaceLibrary();");
    expect(workspaceSource).not.toMatch(/\b(?:createDocument|createDocuments|createFolder|deleteDocument|deleteFolder|listContent|moveDocument|renameFolder)\b/);
    expect(workspaceSource).not.toContain("from \"@/lib/tree\"");
  });
});
