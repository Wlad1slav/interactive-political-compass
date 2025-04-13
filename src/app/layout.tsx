import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Github } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Interactive Political Compass",
  description: "",
  openGraph: {
    title: "Interactive Political Compass",
    images: [`${process.env.DOMAIN}/Political_Compass_standard_model.svg.png`]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="google-site-verification" content={process.env.SITE_VERIFICATION} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        cz-shortcut-listen="true"
      >
        <div className="relative">
          <a href={process.env.GITHUB_URL} className="absolute right-0 m-4 flex items-center gap-1">
            <Github />
            <span className="text-xs font-semibold">Wlad1slav</span>
          </a>
          {children}
        </div>
      </body>
    </html>
  );
}
