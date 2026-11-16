import Link from "next/link";
import type { ReactNode } from "react";
import { fmt, REPOSITORIO, SITE_GRUPO } from "@/lib/dominio";

function Marca({ href, children }: { href: string | null; children: ReactNode }) {
  return href ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <>{children}</>;
}

export function Rodape({ origem }: { origem: { viaApi: boolean; ultimaAlteracao: string | null } }) {
  return (
    <footer className="mt-8 border-t border-borda bg-superficie text-[13px] text-texto-2">
      <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-start justify-between gap-x-10 gap-y-4 px-4 py-5 sm:px-6">
        <div className="flex max-w-2xl items-start gap-4">
          {/* Quando o grupo tiver site, envolver o logotipo e o nome num link (SITE_GRUPO em lib/dominio.ts). */}
          <Marca href={SITE_GRUPO}>
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem estática pequena; o site é exportado sem otimizador */}
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/marca/gpgeoia.png`} alt="Logotipo do GPGeoIA" width={76} height={96} className="h-24 w-auto shrink-0" />
          </Marca>
          <div className="min-w-0">
            <p className="font-semibold text-texto">Geo-Fundiário</p>
            <p className="mt-1 leading-relaxed">
              Desenvolvido pelo GPGeoIA - Grupo de Pesquisa em Inteligência Artificial Geoespacial da Universidade Federal de Viçosa (UFV).
            </p>
            <p className="leading-relaxed">Responsável: Prof. Dr. Darlan Miranda Nunes (<a href="https://orcid.org/0000-0001-5566-7919" target="_blank" rel="noreferrer" className="text-azul hover:underline">ORCID 0000-0001-5566-7919</a>).</p>
            <p className="mt-1 leading-relaxed text-texto-3">
              Dados de demonstração fictícios, simulados sobre edificações do campus da UFV. Nenhum desses prédios está em regularização fundiária.
            </p>
          </div>
        </div>
        <nav aria-label="Rodapé" className="grid grid-cols-2 gap-x-10 gap-y-1.5">
          <Link href="/ajuda" className="hover:text-azul hover:underline">Como funciona</Link>
          <Link href="/legislacao" className="hover:text-azul hover:underline">Base legal</Link>
          <Link href="/ajuda#dados" className="hover:text-azul hover:underline">Modelo de dados (LADM)</Link>
          <a href={REPOSITORIO} target="_blank" rel="noreferrer" className="hover:text-azul hover:underline">Código-fonte</a>
          <Link href="/ajuda#creditos" className="hover:text-azul hover:underline">Créditos e fontes</Link>
          <a href={`${REPOSITORIO}/blob/main/LICENSE`} target="_blank" rel="noreferrer" className="hover:text-azul hover:underline">Licença AGPL-3.0</a>
        </nav>
        <p className="w-full border-t border-borda pt-3 text-[12.5px] text-texto-3">
          {origem.viaApi ? "Dados lidos da API, ao vivo" : "Dados: instantâneo exportado do banco PostgreSQL/PostGIS"}
          {origem.ultimaAlteracao ? `, última alteração em ${fmt.data(origem.ultimaAlteracao)}` : ""}. Mapas: © OpenStreetMap, OpenFreeMap, Esri.
        </p>
      </div>
    </footer>
  );
}
