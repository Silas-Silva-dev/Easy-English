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
  experimental: {
    // Uploads de audio do estudante chegam como multipart nas Server Actions.
    serverActions: { bodySizeLimit: "12mb" },
    // TypeScript 7 nao expoe a compiler API interna que o Next usa por padrao;
    // com esta flag o build valida os tipos chamando o proprio `tsc`.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
