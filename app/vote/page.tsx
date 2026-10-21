import type { Metadata } from "next";
import { SeatEditor } from "@/components/SeatEditor";
import { getPublicConfig } from "@/lib/config";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "חלוקת המנדטים · מנדטים 2026" };

export default async function VotePage() {
  return <SeatEditor config={await getPublicConfig(prisma)} />;
}
