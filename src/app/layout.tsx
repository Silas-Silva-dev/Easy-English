import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";

import { ThemeProvider, themeInitScript } from "@/components/theme-provider";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

/**
 * A serifada do certificado NÃO mora aqui.
 *
 * Morava: `Cormorant_Garamond` estava neste layout, que é o layout raiz, então
 * ela descia para todas as páginas do site. São dois arquivos de fonte — a
 * normal e a itálica — somando 80 KiB, mais dois `<link rel="preload">`
 * disputando banda com o resto no instante em que a página está pintando. Numa
 * medição móvel isso é metade de todo o peso de fonte da home.
 *
 * E ela aparece em um único componente, o `CertificateFrame`. Agora é lá que
 * ela é declarada, e só quem abre o certificado a baixa.
 */

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Easy English: Inglês para conversação com tutora de IA",
    template: "%s",
  },
  description:
    "Plataforma de cursos de inglês focada em conversação. 728 dias no seu ritmo, com uma tutora de IA que ouve sua fala, corrige a pronúncia e mostra exatamente como melhorar.",
  keywords: ["inglês", "conversação", "curso online", "pronúncia", "IA", "fluência"],
  authors: [{ name: "Easy English" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Easy English",
    title: "Easy English: Inglês para conversação com tutora de IA",
    description:
      "728 dias, do seu jeito. Grave sua fala e receba correção de pronúncia feita sob medida para brasileiros.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Easy English" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Easy English: Inglês para conversação com tutora de IA",
    description: "728 dias, do seu jeito, com uma tutora de IA que ouve você falar.",
    images: ["/og-image.png"],
  },
  // `favicon.ico` e `icon.svg` vivem em src/app/ e o Next os liga sozinho.
  // O apple-touch precisa ser declarado: o iOS não lê o manifesto para isso.
  icons: {
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  applicationName: "Easy English",
  appleWebApp: {
    capable: true,
    title: "Easy English",
    // A barra de status fica translúcida sobre o app, como em app nativo.
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  // Tema escuro padrão
  themeColor: "#101318",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} ${display.variable} antialiased`}>
        <ThemeProvider>
          {children}
          {/* O toast nasce no topo, onde fica a barra de status do iOS no app
              instalado. Sem o recuo ele sai por baixo do relógio. */}
          <Toaster
            position="top-right"
            offset="calc(1rem + env(safe-area-inset-top, 0px))"
            richColors
            closeButton
            toastOptions={{ classNames: { toast: "font-sans" } }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
