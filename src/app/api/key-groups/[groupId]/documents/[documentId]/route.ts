import { groupError, groupJson, jsonBody, requireGroupKey, validEntityId } from "@/server/key-groups/http";
import { deleteDocument, updateDocument } from "@/server/key-groups/runtime";
import { requestAddress } from "@/server/request-address";
import { KeyGroupError } from "@/server/key-groups/store";

type Context = { params: Promise<{ groupId: string; documentId: string }> };
async function ids(context: Context) { const value = await context.params; if (!validEntityId(value.groupId) || !validEntityId(value.documentId)) throw new KeyGroupError("NOT_FOUND", "Document not found"); return value; }
export async function PATCH(request: Request, context: Context) {
  try { const { groupId, documentId } = await ids(context); const body = await jsonBody(request); return groupJson(await updateDocument(groupId, requireGroupKey(request), documentId, body as { title?: string; body?: string; folderId?: string | null; order?: number; expectedVersion: number }, requestAddress(request.headers))); }
  catch (error) { return groupError(error, "Could not update document"); }
}
export async function DELETE(request: Request, context: Context) {
  try { const { groupId, documentId } = await ids(context); const body = await jsonBody(request); await deleteDocument(groupId, requireGroupKey(request), documentId, Number(body.expectedVersion), requestAddress(request.headers)); return groupJson({ deleted: true }); }
  catch (error) { return groupError(error, "Could not delete document"); }
}
