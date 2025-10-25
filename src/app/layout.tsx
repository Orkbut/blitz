import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import PWAInstaller from "@/components/PWAInstaller";
import PWAStateManager from "@/components/PWAStateManager";

export const metadata: Metadata = {
  title: "Radar Detran - Sistema EU VOU",
  description: "Sistema de gestão de operações DETRAN Ceará - PWA",
  generator: "Next.js",
  manifest: "/manifest.json",
  keywords: ["detran", "ceará", "diárias", "solicitações", "pwa"],
  authors: [{ name: "DETRAN CE" }],
  icons: {
    icon: "/icons/icon-192x192.png",
    shortcut: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
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
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        
        {/* Favicon */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        
        {/* Splash Screens */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-startup-image" href="/icons/icon-512x512.png" />
      </head>
      <body>
        <RealtimeProvider>
          <PWAStateManager />
          {children}
          <PWAInstaller />
        </RealtimeProvider>
      </body>
    </html>
  );
}
