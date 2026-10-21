import { userFromRequest } from "@/lib/auth";
import { errorJson, json } from "@/lib/http";
import { getVote } from "@/lib/votes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return errorJson("לא מזוהה. יש להירשם מחדש.", 401);
  return json({ user: { id: user.id, name: user.name }, vote: await getVote(user.id) });
}
