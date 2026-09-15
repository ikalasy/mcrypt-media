import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { THEME_COOKIE, resolveTheme } from "@/lib/theme";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "MCrypted", template: "%s // MCrypted" },
  description: "Movie Crypted. A private media server.",
  applicationName: "MCrypted",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const store = await cookies();
  const theme = resolveTheme(store.get(THEME_COOKIE)?.value);
  return (
    <html lang="en" data-theme={theme} className={`${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-text">{children}</body>
    </html>
  );
}
