import type { Metadata } from "next";
import { Roboto_Mono, Source_Sans_3 } from "next/font/google";
import { BarraSuperior } from "@/components/barra-superior";
import { PaletaComandos } from "@/components/paleta-comandos";
import { Rodape } from "@/components/rodape";
import { indiceBusca, listarProjetos, origemDados } from "@/lib/dados";
import "./globals.css";

const texto = Source_Sans_3({ variable: "--font-texto", subsets: ["latin"], weight: ["400", "600", "700"] });
const codigo = Roboto_Mono({ variable: "--font-codigo", subsets: ["latin"], weight: ["400", "500"] });

// Política de conteúdo do site estático: só carrega o que o sistema usa (mapas de base e fontes de mapa).
const DEV = process.env.NODE_ENV === "development"; // o modo de desenvolvimento do React precisa de eval e de WebSocket
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://server.arcgisonline.com https://tiles.openfreemap.org",
  `connect-src 'self' https://tiles.openfreemap.org https://server.arcgisonline.com${DEV ? " ws: http://localhost:*" : ""}`,
  "worker-src 'self' blob:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const metadata: Metadata = {
  title: { default: "Geo-Fundiário", template: "%s - Geo-Fundiário" },
  description: "Plataforma aberta de gestão fundiária e territorial: do levantamento de campo ao registro.",
  referrer: "strict-origin-when-cross-origin",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const projetos = listarProjetos().map((p) => ({ id: p.id, nome: p.nome }));
  return (
    <html lang="pt-BR" className={`${texto.variable} ${codigo.variable} h-full antialiased`}>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
      </head>
      <body className="flex min-h-full flex-col font-sans text-[14px]">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-superficie focus:px-3 focus:py-2 focus:text-azul">Ir para o conteúdo</a>
        <BarraSuperior projetos={projetos} />
        <main id="conteudo" className="min-w-0 flex-1">{children}</main>
        <Rodape origem={origemDados()} />
        <PaletaComandos itens={indiceBusca()} />
      </body>
    </html>
  );
}
