import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Premium Image Compressor",
  description: "Elegantly compress your images under 4.5 MB while maintaining a stunning quality and a max resolution of 7000x7000px.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className={`${inter.className} min-h-full flex flex-col bg-[#09090b]`}>{children}</body>
    </html>
  );
}
