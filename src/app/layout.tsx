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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "InglishEasy — Inglês para conversação com tutora de IA",
    template: "%s · InglishEasy",
  },
  description:
    "Plataforma de cursos de inglês focada em conversação. 728 dias no seu ritmo, com uma tutora de IA que ouve sua fala, corrige a pronúncia e mostra exatamente como melhorar.",
  keywords: ["inglês", "conversação", "curso online", "pronúncia", "IA", "fluência"],
  authors: [{ name: "InglishEasy" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "InglishEasy",
    title: "InglishEasy — Inglês para conversação com tutora de IA",
    description:
      "728 dias, do seu jeito. Grave sua fala e receba correção de pronúncia feita sob medida para brasileiros.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "InglishEasy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "InglishEasy — Inglês para conversação com tutora de IA",
    description: "728 dias, do seu jeito, com uma tutora de IA que ouve você falar.",
    images: ["/og-image.png"],
  },
  // `favicon.ico` e `icon.svg` vivem em src/app/ e o Next os liga sozinho.
  // O apple-touch precisa ser declarado: o iOS não lê o manifesto para isso.
  icons: {
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  applicationName: "InglishEasy",
  appleWebApp: {
    capable: true,
    title: "InglishEasy",
    // A barra de status fica translúcida sobre o app, como em app nativo.
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  // Valor único, do tema claro (o padrão). Não pode ser por
  // `prefers-color-scheme`: o tema do app vem do localStorage, não do aparelho,
  // e a barra do navegador ficaria escura sobre uma página clara. Quem trocar
  // para o escuro tem esta meta atualizada pelo `themeInitScript`.
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  // Sem `maximumScale`: travar o zoom quebra a acessibilidade de quem precisa
  // ampliar, e o iOS ignora isso de qualquer forma desde o Safari 10.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} ${display.variable} antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{ classNames: { toast: "font-sans" } }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
