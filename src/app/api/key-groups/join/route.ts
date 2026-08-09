import { groupError, groupJson, requireGroupKey } from "@/server/key-groups/http";
import { joinGroup } from "@/server/key-groups/runtime";
import { requestAddress } from "@/server/request-address";

export async function POST(request: Request) {
  try { return groupJson(await joinGroup(requireGroupKey(request), requestAddress(request.headers))); }
  catch (error) { return groupError(error, "Could not join group"); }
}
