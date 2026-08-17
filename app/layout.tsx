import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: "0523 回音星核｜给小宝贝的七夕礼物",
    description: "一片会认真回应小宝贝每一次分享的宇宙。",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "0523 回音星核",
      description: "给小宝贝的七夕礼物",
      images: [{ url: "/og.png", width: 1536, height: 919, alt: "0523 回音星核" }],
    },
    twitter: { card: "summary_large_image", title: "0523 回音星核", description: "给小宝贝的七夕礼物", images: ["/og.png"] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#02030a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
