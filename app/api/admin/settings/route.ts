import { getAdminState, updateSettings } from "@/lib/admin";
import { adminGet, adminPost } from "@/lib/admin-route";

export const dynamic = "force-dynamic";

/** Lock state, threshold, real results and the registered users. */
export const GET = adminGet(() => getAdminState());
/** {lockMode?: "scheduled"|"open"|"closed", lockAt?: ISO|null, minSeats?: number} */
export const POST = adminPost(updateSettings);
