import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tặng Mẹ Sen · design by NMC",
  description: "Hệ thống tạo hồ sơ kiểm tra sức khỏe - Bảo Việt Nhân thọ An Giang",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌸</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${geistSans.variable} antialiased`}>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
