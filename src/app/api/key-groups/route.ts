import { requestAddress } from "@/server/request-address";
import { groupError, groupJson, jsonBody, requireGroupKey } from "@/server/key-groups/http";
import { createGroup } from "@/server/key-groups/runtime";
import type { LocalGroupImport } from "@/types/key-group";

export async function POST(request: Request) {
  try {
    const key = requireGroupKey(request);
    const input = await jsonBody(request) as LocalGroupImport;
    return groupJson(await createGroup(input, key, requestAddress(request.headers)), 201);
  } catch (error) { return groupError(error, "Could not create group"); }
}
