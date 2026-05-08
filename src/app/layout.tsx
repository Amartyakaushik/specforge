import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpecForge — Application Compiler",
  description: "Natural language to validated, executable application configurations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
