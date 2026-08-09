import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { GroupSettingsDialog } from "@/components/mdez/GroupSettingsDialog";

const group = { id: "g1", name: "Writers", revision: 2, deletedAt: null, purgeAfter: null, createdAt: "2026-08-09T00:00:00.000Z", updatedAt: "2026-08-09T00:00:00.000Z" };

it("distinguishes local leave from server-wide group deletion", () => {
  const onLeave = vi.fn(); const onDelete = vi.fn();
  render(<GroupSettingsDialog open group={group} busy={false} onClose={vi.fn()} onRename={vi.fn()} onLeave={onLeave} onDelete={onDelete} onRestore={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Leave group on this browser" })); expect(onLeave).toHaveBeenCalledOnce(); expect(onDelete).not.toHaveBeenCalled();
  expect(screen.getByText("Deleting the group stops editing for every key holder.")).toBeVisible();
});
