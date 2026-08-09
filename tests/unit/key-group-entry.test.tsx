import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateGroupDialog } from "@/components/mdez/CreateGroupDialog";
import { JoinGroupDialog } from "@/components/mdez/JoinGroupDialog";
import { WorkspaceSwitcher } from "@/components/mdez/WorkspaceSwitcher";
import * as client from "@/lib/key-group-client";
import * as repository from "@/lib/key-group-repository";
import type { GroupSnapshot } from "@/types/key-group";

vi.mock("@/lib/key-group-client");
vi.mock("@/lib/key-group-repository");

const key = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";
const timestamp = "2026-08-09T00:00:00.000Z";
const snapshot: GroupSnapshot = { group: { id: "g1", name: "Writers", revision: 0, deletedAt: null, purgeAfter: null, createdAt: timestamp, updatedAt: timestamp }, folders: [], documents: [] };

describe("Key Group entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(client.createKeyGroup).mockResolvedValue(snapshot);
    vi.mocked(client.joinKeyGroup).mockResolvedValue(snapshot);
    vi.mocked(repository.rememberGroup).mockResolvedValue("g1");
    vi.mocked(repository.cacheGroupSnapshot).mockResolvedValue("g1");
  });

  it("copies the complete Local Library exactly once when creating", async () => {
    render(<CreateGroupDialog open folders={[]} documents={[]} onClose={vi.fn()} onCreated={vi.fn()} generateKey={() => key} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Group name" }), { target: { value: "Writers" } });
    fireEvent.click(screen.getByRole("button", { name: "Create and copy Local Library" }));
    await waitFor(() => expect(client.createKeyGroup).toHaveBeenCalledWith(expect.objectContaining({ key, import: expect.objectContaining({ name: "Writers", folders: [], documents: [] }) })));
    expect(await screen.findByLabelText("Group key")).toHaveValue(key);
  });

  it("joins with one key and remembers the returned group", async () => {
    const onJoined = vi.fn();
    render(<JoinGroupDialog open onClose={vi.fn()} onJoined={onJoined} />);
    fireEvent.change(screen.getByLabelText("Group key"), { target: { value: key } });
    fireEvent.click(screen.getByRole("button", { name: "Join group" }));
    await waitFor(() => expect(client.joinKeyGroup).toHaveBeenCalledWith(key));
    expect(repository.rememberGroup).toHaveBeenCalledWith(expect.objectContaining({ key }));
    expect(onJoined).toHaveBeenCalledWith(snapshot.group.id);
  });

  it("switches among Local Library and remembered groups", async () => {
    const onSelect = vi.fn();
    render(<WorkspaceSwitcher activeGroupId={null} groups={[{ groupId: "g1", name: "Writers", key, joinedAt: timestamp, lastOpenedAt: timestamp }]} onSelect={onSelect} onCreate={vi.fn()} onJoin={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Current workspace: Local Library" }));
    fireEvent.click(screen.getByRole("button", { name: "Writers" }));
    expect(onSelect).toHaveBeenCalledWith("g1");
  });
});
