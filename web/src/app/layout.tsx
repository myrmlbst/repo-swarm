import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repo Swarm",
  description: "Submit a repo to be reviewed and audited by agents",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-gray-50 text-gray-900 antialiased print:bg-white">
        <a
          href="#main"
          className="sr-only rounded-lg bg-white px-4 py-2 text-sm font-medium text-blue-800 shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 print:hidden"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
