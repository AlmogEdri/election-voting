import { json } from "@/lib/http";
import { getPublicStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(await getPublicStats());
}
