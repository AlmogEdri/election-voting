import type { Metadata } from "next";
import { PmStep } from "@/components/PmStep";
import { getPublicConfig } from "@/lib/config";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ראש הממשלה · מנדטים 2026" };

export default async function PrimeMinisterPage() {
  return <PmStep config={await getPublicConfig(prisma)} />;
}
