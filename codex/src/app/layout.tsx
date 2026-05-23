import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Developer Profile Analyzer",
  description: "Analyze a public GitHub profile with deterministic engineering scores and Gemini-powered recommendations."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
