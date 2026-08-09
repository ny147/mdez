import { groupError, groupJson, requireGroupKey, validEntityId } from "@/server/key-groups/http";
import { getGroupChanges } from "@/server/key-groups/runtime";
import { requestAddress } from "@/server/request-address";
import { KeyGroupError } from "@/server/key-groups/store";

type Context = { params: Promise<{ groupId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { groupId } = await context.params; if (!validEntityId(groupId)) throw new KeyGroupError("NOT_FOUND", "Group not found");
    const after = Number(new URL(request.url).searchParams.get("after")); if (!Number.isSafeInteger(after) || after < 0) return groupJson({ error: "A valid revision cursor is required" }, 400);
    return groupJson(await getGroupChanges(groupId, requireGroupKey(request), after, requestAddress(request.headers)));
  } catch (error) { return groupError(error, "Could not refresh group"); }
}
