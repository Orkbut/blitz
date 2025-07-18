import type { Metadata } from "next";
import "./globals.css";
import { RealtimeProvider } from "@/contexts/RealtimeContext";

export const metadata: Metadata = {
  title: "Sistema EU VOU - DETRAN CE",
  description: "Sistema de gestão de operações DETRAN Ceará",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-theme="light" className="light">
      <head>
        {/* Prevenção de problemas no iOS com detecção automática */}
        <meta
          name="format-detection"
          content="telephone=no, date=no, email=no, address=no"
        />
      </head>
      <body>
        <RealtimeProvider>
          {children}
        </RealtimeProvider>
      </body>
    </html>
  );
}
