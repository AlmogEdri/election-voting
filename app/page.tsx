import Link from "next/link";
import { RegistrationForm } from "@/components/RegistrationForm";

export default function HomePage() {
  return (
    <main className="pt-10">
      <h1 className="text-4xl font-extrabold text-blue-900">מנדטים 2026</h1>
      <p className="mt-3 text-lg leading-relaxed text-slate-700">
        איך יתחלקו 120 המנדטים בבחירות לכנסת ה-26 (27.10.2026)?
        <br />
        חלקו את המנדטים בין הרשימות ובחרו מי יהיה ראש הממשלה.
      </p>
      <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <RegistrationForm />
      </section>
      <p className="mt-6 text-center text-sm text-slate-600">
        בלי התחברות ובלי פרטים אישיים, רק שם.{" "}
        <Link href="/results" className="font-medium text-blue-800 underline">
          לתוצאות עד עכשיו
        </Link>
      </p>
    </main>
  );
}
