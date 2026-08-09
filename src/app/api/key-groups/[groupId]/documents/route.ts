import { groupError, groupJson, jsonBody, requireGroupKey, validEntityId } from "@/server/key-groups/http";
import { createDocument } from "@/server/key-groups/runtime";
import { requestAddress } from "@/server/request-address";
import { KeyGroupError } from "@/server/key-groups/store";

type Context = { params: Promise<{ groupId: string }> };
export async function POST(request: Request, context: Context) {
  try { const { groupId } = await context.params; if (!validEntityId(groupId)) throw new KeyGroupError("NOT_FOUND", "Group not found"); const body = await jsonBody(request); return groupJson(await createDocument(groupId, requireGroupKey(request), { title: String(body.title ?? ""), body: String(body.body ?? ""), folderId: body.folderId === null ? null : String(body.folderId ?? "") }, requestAddress(request.headers)), 201); }
  catch (error) { return groupError(error, "Could not create document"); }
}
