import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Linxys Kundenportal", template: "%s · Linxys Kundenportal" },
  description: "Kundenportal der Linxys Bitrix24-Beratung",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
