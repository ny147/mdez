import { groupError, groupJson, jsonBody, requireGroupKey, validEntityId } from "@/server/key-groups/http";
import { deleteFolder, updateFolder } from "@/server/key-groups/runtime";
import { requestAddress } from "@/server/request-address";
import { KeyGroupError } from "@/server/key-groups/store";

type Context = { params: Promise<{ groupId: string; folderId: string }> };
async function ids(context: Context) { const value = await context.params; if (!validEntityId(value.groupId) || !validEntityId(value.folderId)) throw new KeyGroupError("NOT_FOUND", "Folder not found"); return value; }
export async function PATCH(request: Request, context: Context) {
  try { const { groupId, folderId } = await ids(context); const body = await jsonBody(request); return groupJson(await updateFolder(groupId, requireGroupKey(request), folderId, body as { name?: string; parentId?: string | null; order?: number; expectedVersion: number }, requestAddress(request.headers))); }
  catch (error) { return groupError(error, "Could not update folder"); }
}
export async function DELETE(request: Request, context: Context) {
  try { const { groupId, folderId } = await ids(context); const body = await jsonBody(request); await deleteFolder(groupId, requireGroupKey(request), folderId, Number(body.expectedVersion), requestAddress(request.headers)); return groupJson({ deleted: true }); }
  catch (error) { return groupError(error, "Could not delete folder"); }
}
