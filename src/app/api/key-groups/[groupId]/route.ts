import { groupError, groupJson, jsonBody, requireGroupKey, validEntityId } from "@/server/key-groups/http";
import { deleteGroup, getGroupSnapshot, renameGroup, restoreGroup } from "@/server/key-groups/runtime";
import { requestAddress } from "@/server/request-address";
import { KeyGroupError } from "@/server/key-groups/store";

type Context = { params: Promise<{ groupId: string }> };
async function id(context: Context) { const { groupId } = await context.params; if (!validEntityId(groupId)) throw new KeyGroupError("NOT_FOUND", "Group not found"); return groupId; }

export async function GET(request: Request, context: Context) {
  try { return groupJson(await getGroupSnapshot(await id(context), requireGroupKey(request), requestAddress(request.headers))); }
  catch (error) { return groupError(error, "Could not load group"); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const groupId = await id(context); const key = requireGroupKey(request); const body = await jsonBody(request); const address = requestAddress(request.headers);
    return groupJson(body.restore === true ? await restoreGroup(groupId, key, address) : await renameGroup(groupId, key, String(body.name ?? ""), address));
  } catch (error) { return groupError(error, "Could not update group"); }
}
export async function DELETE(request: Request, context: Context) {
  try { return groupJson(await deleteGroup(await id(context), requireGroupKey(request), requestAddress(request.headers))); }
  catch (error) { return groupError(error, "Could not delete group"); }
}
