import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repo Swarm",
  description: "Submit a repo to be reviewed and audited by agents",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
