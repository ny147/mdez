import { duration, initiators, type RequestSample } from "./metrics";

const root = "/api/key-groups";
const routes = [root, `${root}/join`, `${root}/:groupId`, `${root}/:groupId/changes`, `${root}/:groupId/documents`, `${root}/:groupId/documents/:documentId`, `${root}/:groupId/folders`, `${root}/:groupId/folders/:folderId`, "unknown"];
export function normalizeRoute(raw: string): string {
  const parts = new URL(raw).pathname.split("/").filter(Boolean);
  if (parts[0] !== "api" || parts[1] !== "key-groups") return "unknown";
  if (parts.length === 2) return root;
  if (parts.length === 3) return parts[2] === "join" ? `${root}/join` : `${root}/:groupId`;
  if (parts.length === 4 && ["changes", "documents", "folders"].includes(parts[3])) return `${root}/:groupId/${parts[3]}`;
  if (parts.length === 5 && ["documents", "folders"].includes(parts[3])) return `${root}/:groupId/${parts[3]}/:${parts[3] === "documents" ? "documentId" : "folderId"}`;
  return "unknown";
}
export function attributeRequest(method: string, route: string, context: RequestSample["initiator"]): RequestSample["initiator"] {
  // Temporal overlap alone never establishes navigation, polling, or refresh causation.
  if (method === "PATCH" && route.endsWith("/:documentId") && context !== "mutation") return "autosave";
  if (method === "PATCH" && route.endsWith("/:documentId")) return "unknown";
  if (["POST", "PATCH", "DELETE"].includes(method) && context === "mutation") return "mutation";
  if (method === "GET" && context === "initial-load" && route === `${root}/:groupId`) return "initial-load";
  return "unknown";
}
export function parseServerTiming(value: string): RequestSample["serverTiming"] {
  const spans: RequestSample["serverTiming"] = {};
  for (const part of value.split(",")) {
    const match = part.trim().match(/^(total|authorize|rate_limit|store|serialize);dur=(\d+(?:\.\d+)?);desc="(\d+)"$/);
    if (match && Number.isFinite(Number(match[2])) && Number.isSafeInteger(Number(match[3]))) spans[match[1] as keyof typeof spans] = { duration: Number(match[2]), count: Number(match[3]) };
  }
  return spans;
}
export function requestSample(input: { method: string; url: string; startMs: number }): RequestSample {
  return { method: ["GET", "POST", "PATCH", "DELETE"].includes(input.method) ? input.method as RequestSample["method"] : "OTHER", route: normalizeRoute(input.url), initiator: "unknown", startMs: duration(input.startMs)!, endMs: null, status: null, requestBytes: null, responseBytes: null, decodedResponseBytes: null, transferBytes: null, serverTiming: {}, requestId: null };
}
export function serializeRequestSample(sample: RequestSample & Record<string, unknown>): string {
  if (!routes.includes(sample.route) || !initiators.includes(sample.initiator) || !["GET", "POST", "PATCH", "DELETE", "OTHER"].includes(sample.method)) throw new Error("Invalid request category");
  const requestId = sample.requestId && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sample.requestId) ? sample.requestId : null;
  const serverTiming = parseServerTiming(Object.entries(sample.serverTiming).map(([name, span]) => `${name};dur=${span.duration};desc="${span.count}"`).join(","));
  return JSON.stringify({ method: sample.method, route: sample.route, initiator: sample.initiator, startMs: duration(sample.startMs), endMs: duration(sample.endMs), status: sample.status === null ? null : Number.isInteger(sample.status) && sample.status >= 100 && sample.status <= 599 ? sample.status : null, requestBytes: duration(sample.requestBytes), responseBytes: duration(sample.responseBytes), decodedResponseBytes: duration(sample.decodedResponseBytes), transferBytes: duration(sample.transferBytes), serverTiming, requestId });
}

