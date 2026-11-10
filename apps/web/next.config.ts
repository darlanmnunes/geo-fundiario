import type { NextConfig } from "next";

// Dois modos de build:
//  - padrão: servidor Next (dev e produção com API);
//  - NEXT_OUTPUT=export: site estático (demonstração no GitHub Pages), opcionalmente sob NEXT_BASE_PATH.
const exportar = process.env.NEXT_OUTPUT === "export";
const basePath = process.env.NEXT_BASE_PATH?.replace(/\/$/, "") || "";

const nextConfig: NextConfig = {
  // Cache Components e Partial Prefetching não existem no modo de exportação estática.
  cacheComponents: !exportar,
  partialPrefetching: !exportar,
  output: exportar ? "export" : undefined,
  trailingSlash: exportar, // GitHub Pages: /projetos/1/ → projetos/1/index.html
  basePath: basePath || undefined,
  images: { unoptimized: exportar },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
