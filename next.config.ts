import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co").hostname;
  } catch {
    return "placeholder.supabase.co";
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  /**
   * O Next carimba as páginas pré-renderizadas com `s-maxage=31536000` — um
   * ano. Isso pressupõe um CDN que limpa o cache a cada deploy; o da Hostinger
   * não limpa. O edge continua entregando o HTML do build anterior, que aponta
   * para chunks com hash antigo já apagados do servidor: o CSS volta 404 e a
   * página abre sem estilo, ou a navegação morre em "This page couldn't load".
   *
   * Aqui entram SOMENTE as rotas 100% públicas e pré-renderizadas (as marcadas
   * com ○ no build). A regra não pode ser ampla: as rotas dinâmicas saem com
   * `no-store` de propósito, porque podem conter dados do aluno logado — um
   * `s-maxage` público faria o CDN guardar a tela de um usuário e servir para
   * outro.
   */
  async headers() {
    const publicHtml = [
      { key: "Cache-Control", value: "public, max-age=0, s-maxage=60, stale-while-revalidate=300" },
    ];

    return [
      { source: "/", headers: publicHtml },
      { source: "/cadastro", headers: publicHtml },
    ];
  },
  experimental: {
    // Uploads de audio do estudante chegam como multipart nas Server Actions.
    serverActions: { bodySizeLimit: "12mb" },
    // TypeScript 7 nao expoe a compiler API interna que o Next usa por padrao;
    // com esta flag o build valida os tipos chamando o proprio `tsc`.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
