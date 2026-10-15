import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { GroupSettingsDialog } from "@/components/mdez/GroupSettingsDialog";

const group = { id: "g1", name: "Writers", revision: 2, deletedAt: null, purgeAfter: null, createdAt: "2026-08-09T00:00:00.000Z", updatedAt: "2026-08-09T00:00:00.000Z" };
const groupKey = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";
const props = { group, busy: false, onClose: vi.fn(), onRename: vi.fn(), onLeave: vi.fn(), onDelete: vi.fn(), onRestore: vi.fn() };

it("lets a member reveal and hide their remembered key, masking it again on reopen", () => {
  const { rerender } = render(<GroupSettingsDialog {...props} open groupKey={groupKey} />);
  expect(screen.getByLabelText("Group key")).toHaveAttribute("type", "password");
  expect(screen.getByLabelText("Group key")).toHaveValue(groupKey);
  fireEvent.click(screen.getByRole("button", { name: "Show key" }));
  expect(screen.getByLabelText("Group key")).toHaveAttribute("type", "text");
  fireEvent.click(screen.getByRole("button", { name: "Hide key" }));
  expect(screen.getByLabelText("Group key")).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Show key" }));
  rerender(<GroupSettingsDialog {...props} open={false} groupKey={groupKey} />);
  rerender(<GroupSettingsDialog {...props} open groupKey={groupKey} />);
  expect(screen.getByLabelText("Group key")).toHaveAttribute("type", "password");
});

it("copies the remembered key with confirmation", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<GroupSettingsDialog {...props} open groupKey={groupKey} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy key" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Key copied");
  expect(writeText).toHaveBeenCalledWith(groupKey);
  vi.unstubAllGlobals();
});

it("offers manual copying when clipboard access fails", async () => {
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } });
  render(<GroupSettingsDialog {...props} open groupKey={groupKey} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy key" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Show the key and copy it manually");
  vi.unstubAllGlobals();
});

it("distinguishes local leave from server-wide group deletion", () => {
  const onLeave = vi.fn(); const onDelete = vi.fn();
  render(<GroupSettingsDialog open group={group} busy={false} onClose={vi.fn()} onRename={vi.fn()} onLeave={onLeave} onDelete={onDelete} onRestore={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Leave group on this browser" })); expect(onLeave).toHaveBeenCalledOnce(); expect(onDelete).not.toHaveBeenCalled();
  expect(screen.getByText("Deleting the group stops editing for every key holder.")).toBeVisible();
});
