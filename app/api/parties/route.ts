import { getPublicConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(await getPublicConfig(prisma));
}
