import type { MetadataRoute } from "next";

/**
 * Manifesto do app instalável.
 *
 * É isto que faz o atalho na tela inicial do celular sair com ícone e nome
 * próprios em vez de um retângulo com a miniatura da página.
 *
 * `display: standalone` abre sem a barra do navegador: o aluno que estuda
 * todo dia acaba instalando, e sem isso o app perde ~15% da tela útil para a
 * barra de endereço em cada sessão.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "InglishEasy: Inglês para conversação",
    short_name: "InglishEasy",
    description:
      "728 dias de inglês para conversação, no seu ritmo, com uma tutora de IA que ouve sua fala e corrige a pronúncia.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    prefer_related_applications: false,
    background_color: "#ffffff",
    theme_color: "#FF4A17",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["education"],
    screenshots: [
      {
        src: "/og-image.png",
        sizes: "1200x630",
        type: "image/png",
        form_factor: "wide",
        label: "InglishEasy - Plataforma de Inglês para Conversação",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        form_factor: "narrow",
        label: "InglishEasy App Mobile",
      },
    ],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Sangria total: o Android recorta este na forma do sistema.
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Lição de hoje", short_name: "Hoje", url: "/app" },
      { name: "Revisão espaçada", short_name: "Revisão", url: "/app/revisao" },
      { name: "Conversa ao vivo", short_name: "Ao vivo", url: "/app/ao-vivo" },
    ],
  };
}
