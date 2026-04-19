import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { clientBrandCss, getActiveClient } from "@/lib/clients/active";

export const metadata: Metadata = {
  title: "Campaign OS — Door Knock",
  description: "District-agnostic door-knock management for campaign teams.",
  manifest: "/manifest.webmanifest",
  applicationName: "Campaign OS Door Knock",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Campaign OS",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1F3A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const activeClient = await getActiveClient();
  const brandStyle = clientBrandCss(activeClient?.brand);

  return (
    <html lang="en" data-client={activeClient?.slug ?? "apex"}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+Pro:wght@400;600&display=swap"
          rel="stylesheet"
        />
        {brandStyle ? (
          <style dangerouslySetInnerHTML={{ __html: `:root{${brandStyle}}` }} />
        ) : null}
      </head>
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
