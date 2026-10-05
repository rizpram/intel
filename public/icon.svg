import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RIZPRAM Intelligence | Command Center",
  description: "Social and narrative intelligence command center",
  icons: { icon: "/icon.svg" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
