import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";

export const metadata: Metadata = { title: "ניהול · מנדטים 2026", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <main className="pt-6">
      <h1 className="text-2xl font-extrabold text-blue-900">ניהול</h1>
      <AdminPanel />
    </main>
  );
}
