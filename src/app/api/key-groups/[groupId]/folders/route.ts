import { groupError, groupJson, jsonBody, requireGroupKey, validEntityId } from "@/server/key-groups/http";
import { createFolder } from "@/server/key-groups/runtime";
import { requestAddress } from "@/server/request-address";
import { KeyGroupError } from "@/server/key-groups/store";

type Context = { params: Promise<{ groupId: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const { groupId } = await context.params; if (!validEntityId(groupId)) throw new KeyGroupError("NOT_FOUND", "Group not found"); const body = await jsonBody(request);
    return groupJson(await createFolder(groupId, requireGroupKey(request), { name: String(body.name ?? ""), parentId: body.parentId === null ? null : String(body.parentId ?? "") }, requestAddress(request.headers)), 201);
  } catch (error) { return groupError(error, "Could not create folder"); }
}
