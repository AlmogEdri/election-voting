import { deleteUser } from "@/lib/admin";
import { adminPost } from "@/lib/admin-route";

export const dynamic = "force-dynamic";

/** {userId} — removes the user and their vote. */
export const POST = adminPost(deleteUser);
