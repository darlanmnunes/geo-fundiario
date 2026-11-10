import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { BarraSuperior } from "@/components/barra-superior";
import { PaletaComandos } from "@/components/paleta-comandos";
import { indiceBusca, listarProjetos } from "@/lib/dados";
import "./globals.css";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz", "SOFT", "WONK"] });

export const metadata: Metadata = {
  title: { default: "Geo-Fundiário", template: "%s · Geo-Fundiário" },
  description: "Plataforma aberta de gestão fundiária e territorial — do levantamento de campo ao registro.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const projetos = listarProjetos().map((p) => ({ id: p.id, nome: p.nome, modalidade: p.modalidade, fase: p.fase_atual }));
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans text-[14px]">
        <BarraSuperior projetos={projetos} />
        <main className="min-w-0 flex-1">{children}</main>
        <PaletaComandos itens={indiceBusca()} />
      </body>
    </html>
  );
}
