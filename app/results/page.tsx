import type { Metadata } from "next";
import { Results } from "@/components/Results";
import { getPublicConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { getPublicStats } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "תוצאות · מנדטים 2026" };

export default async function ResultsPage() {
  const [config, stats] = await Promise.all([getPublicConfig(prisma), getPublicStats()]);
  return <Results config={config} initialStats={stats} />;
}
