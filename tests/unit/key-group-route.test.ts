import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/key-groups/[groupId]/route";
import { PATCH } from "@/app/api/key-groups/[groupId]/documents/[documentId]/route";
import * as runtime from "@/server/key-groups/runtime";

vi.mock("server-only", () => ({}));
vi.mock("@/server/key-groups/runtime", () => ({
  getGroupSnapshot: vi.fn(),
  updateDocument: vi.fn(),
}));

const validKey = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";

describe("Key Group routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never accepts a group key in a URL", async () => {
    const response = await GET(new Request(`https://mdez.app/api/key-groups/g1?key=${validKey}`), { params: Promise.resolve({ groupId: "g1" }) });
    expect(response.status).toBe(401);
    expect(runtime.getGroupSnapshot).not.toHaveBeenCalled();
  });

  it("returns a typed 409 conflict without the attempted Markdown", async () => {
    vi.mocked(runtime.updateDocument).mockRejectedValue(Object.assign(new Error("conflict"), { code: "CONFLICT", conflict: { entityType: "document", entityId: "d1", expectedVersion: 1, currentVersion: 2 } }));
    const response = await PATCH(new Request("https://mdez.app/api/key-groups/g1/documents/d1", { method: "PATCH", headers: { "x-mdez-group-key": validKey }, body: JSON.stringify({ body: "my draft", expectedVersion: 1 }) }), { params: Promise.resolve({ groupId: "g1", documentId: "d1" }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "VERSION_CONFLICT", conflict: { entityType: "document", entityId: "d1", expectedVersion: 1, currentVersion: 2 } });
  });
});
