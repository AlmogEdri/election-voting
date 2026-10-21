import { userFromRequest } from "@/lib/auth";
import { errorJson, json, readJson } from "@/lib/http";
import { saveVote } from "@/lib/votes";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return errorJson("לא מזוהה. יש להירשם מחדש.", 401);
  const result = await saveVote(user.id, await readJson(request));
  if (!result.ok) return errorJson(result.error, result.status);
  return json({ ok: true });
}
