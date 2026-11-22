import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans_Thai, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kanban Board บันทึกงาน",
  description: "บอร์ดบันทึกงานส่วนตัวและ Dashboard วิเคราะห์ปริมาณงาน",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the class on <html> before hydration.
    <html
      lang="th"
      suppressHydrationWarning
      className={`${inter.variable} ${plexThai.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Browser extensions (password managers, Grammarly, ...) add attributes to <body>
          before React hydrates; ignore attribute differences on this element only. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
