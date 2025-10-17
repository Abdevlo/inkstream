import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import { BlobCursor } from '@/components/ui/blob-cursor';

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InkStream - Live Canvas Streaming Platform",
  description: "Broadcast your interactive canvas with live components. Perfect for teaching, presentations, and collaborative coding sessions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <BlobCursor />
        {children}
        <Toaster  position="bottom-right" />
      </body>
    </html>
  );
}
