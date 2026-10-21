import type { Metadata, Viewport } from "next";
import { BallotProvider } from "@/components/BallotProvider";
import { DeviceProvider } from "@/components/DeviceProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "מנדטים 2026",
  description: "מה תהיה תוצאת הבחירות לכנסת ה-26? חלקו 120 מנדטים ובחרו מי יהיה ראש הממשלה.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e3a8a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-dvh antialiased">
        <DeviceProvider>
          <BallotProvider>
            <div className="mx-auto w-full max-w-xl px-4 pb-28">{children}</div>
          </BallotProvider>
        </DeviceProvider>
      </body>
    </html>
  );
}
