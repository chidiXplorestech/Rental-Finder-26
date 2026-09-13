import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notts Rental Tracker",
  description: "Fresh, professional-friendly two-bedroom rentals around Nottingham.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
