import type { Metadata } from "next";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpecForge - Application Compiler",
  description: "Natural language to validated, executable application configurations. Multi-stage AI pipeline with cross-layer validation and auto-repair.",
  openGraph: {
    title: "SpecForge - Application Compiler",
    description: "Compile natural language into production-ready app configs",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <TooltipProvider delayDuration={200}>
          {children}
        </TooltipProvider>
        <Toaster position="top-right" richColors theme="dark" />
      </body>
    </html>
  );
}
