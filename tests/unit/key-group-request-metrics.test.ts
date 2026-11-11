import { expect, it } from "vitest";
import { normalizeRoute, requestSample, serializeRequestSample, parseServerTiming, attributeRequest } from "../performance/support/requests";

it("normalizes only known route shapes without exporting IDs or query secrets", () => {
  expect(normalizeRoute("http://localhost/api/key-groups/SECRET/documents/PRIVATE?key=FORBIDDEN")).toBe("/api/key-groups/:groupId/documents/:documentId");
  expect(normalizeRoute("http://localhost/api/key-groups/SECRET/unknown/PRIVATE")).toBe("unknown");
  expect(normalizeRoute("http://localhost/api/key-groups/join")).toBe("/api/key-groups/join");
});
it("represents failed and unavailable metrics explicitly and strips unknown fields", () => {
  const record = requestSample({ method: "GET", url: "http://localhost/api/key-groups/SECRET?key=FORBIDDEN", startMs: 2 });
  expect(record).toMatchObject({ status: null, endMs: null, requestBytes: null, responseBytes: null, transferBytes: null, initiator: "unknown" });
  const serialized = serializeRequestSample({ ...record, rawUrl: "FORBIDDEN", headers: { key: "FORBIDDEN" }, body: "FORBIDDEN" });
  expect(serialized).not.toContain("FORBIDDEN");
  expect(serialized).not.toContain("SECRET");
  expect(() => serializeRequestSample({ ...record, route: "FORBIDDEN" })).toThrow();
});
it("never attributes an overlapping GET or delayed autosave to navigation", () => {
  expect(attributeRequest("GET", "/api/key-groups/:groupId", "navigation")).toBe("unknown");
  expect(attributeRequest("PATCH", "/api/key-groups/:groupId/documents/:documentId", "navigation")).toBe("autosave");
  expect(attributeRequest("GET", "/api/key-groups/:groupId/changes", "mutation")).toBe("unknown");
  expect(attributeRequest("POST", "/api/key-groups/:groupId/documents", "mutation")).toBe("mutation");
  expect(attributeRequest("PATCH", "/api/key-groups/:groupId/documents/:documentId", "mutation")).toBe("unknown");
});
it("accepts only fixed numeric server spans and UUID correlation IDs", () => {
  expect(parseServerTiming('store;dur=1.2;desc="2",SECRET;dur=4,total;dur=5;desc="1"')).toEqual({ store: { duration: 1.2, count: 2 }, total: { duration: 5, count: 1 } });
  expect(parseServerTiming('store;dur=-1;desc="secret"')).toEqual({});
});
