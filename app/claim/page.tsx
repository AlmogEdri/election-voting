import { Suspense } from "react";
import { ClaimDevice } from "@/components/ClaimDevice";

export const metadata = { title: "מעבר למכשיר זה", robots: { index: false, follow: false } };

export default function ClaimPage() {
  return (
    <main className="pt-10">
      <h1 className="text-2xl font-extrabold text-blue-900">מעבר למכשיר זה</h1>
      <Suspense fallback={<p className="mt-3 text-slate-700">רגע…</p>}>
        <ClaimDevice />
      </Suspense>
    </main>
  );
}
