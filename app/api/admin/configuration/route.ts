import { getConfiguration, updateConfiguration } from "@/lib/admin";
import { adminGet, adminPost } from "@/lib/admin-route";

export const dynamic = "force-dynamic";

export const GET = adminGet(() => getConfiguration());
/** {parties: [...], pmCandidates: [...]} — full replacement; missing rows are deactivated. */
export const POST = adminPost(updateConfiguration);
