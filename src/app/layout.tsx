import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { RealtimeProvider } from "@/contexts/RealtimeContext";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Sistema RADAR - DETRAN/CE",
  description: "Registro de Agendamento de Diárias Antecipadas e Recursos",
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
      <body
        className={`${montserrat.variable} font-sans antialiased transition-colors duration-300`}
        style={{
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)'
        }}
      >
        <RealtimeProvider>
        <div 
          className="min-h-screen transition-colors duration-300"
          style={{
            background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-hover) 100%)'
          }}
        >
          {children}
        </div>
        </RealtimeProvider>
        

      </body>
    </html>
  );
}
