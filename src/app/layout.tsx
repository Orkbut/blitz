import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import PWAInstaller from "@/components/PWAInstaller";

export const metadata: Metadata = {
  title: "Radar Detran - Sistema EU VOU",
  description: "Sistema de gestão de operações DETRAN Ceará - PWA",
  generator: "Next.js",
  manifest: "/manifest.json?v=3",
  keywords: ["detran", "ceará", "diárias", "solicitações", "pwa"],
  authors: [{ name: "DETRAN CE" }],
  icons: {
    icon: "/icons/v3/icon-192x192-v3.png",
    shortcut: "/icons/v3/icon-192x192-v3.png",
    apple: "/icons/v3/icon-192x192-v3.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Radar Detran",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Radar Detran",
    title: "Radar Detran - Sistema EU VOU",
    description: "Sistema de gestão de operações DETRAN Ceará",
  },
  twitter: {
    card: "summary",
    title: "Radar Detran - Sistema EU VOU",
    description: "Sistema de gestão de operações DETRAN Ceará",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-theme="light" className="light">
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Radar Detran" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Radar Detran" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/icons/v3/icon-152x152-v3.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/v3/icon-152x152-v3.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/v3/icon-192x192-v3.png" />
        
        {/* Favicon */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/v3/icon-32x32-v3.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/v3/icon-16x16-v3.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        
        {/* Splash Screens */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-startup-image" href="/icons/v3/icon-512x512-v3.png" />
      </head>
      <body>
        <RealtimeProvider>
          {children}
          <PWAInstaller />
        </RealtimeProvider>
      </body>
    </html>
  );
}
