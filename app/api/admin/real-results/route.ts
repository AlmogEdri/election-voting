import { saveRealResults } from "@/lib/admin";
import { adminPost } from "@/lib/admin-route";

export const dynamic = "force-dynamic";

/** {seats: {partyId: n}, pmCandidateId} or {clear: true}. */
export const POST = adminPost(saveRealResults);
