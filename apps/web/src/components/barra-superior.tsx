"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Search } from "lucide-react";
import { fasePorCodigo, MODALIDADE, type CodigoFase } from "@/lib/dominio";

interface Props {
  projetos: { id: number; nome: string; modalidade: string; fase: CodigoFase }[];
}

function Marca() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Geo-Fundiário — início">
      {/* Marca: um lote visto de cima com o vértice marcado, traço de caderneta */}
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className="text-papel-50">
        <path d="M4 7.5 L19 4 L22 19.5 L7 22 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M4 7.5 L22 19.5" stroke="currentColor" strokeWidth="0.9" strokeDasharray="1.5 2.2" />
        <circle cx="19" cy="4" r="2.4" fill="#c9693f" />
      </svg>
      <span className="serif text-[17px] leading-none tracking-tight whitespace-nowrap text-papel-50">Geo-Fundiário</span>
    </Link>
  );
}

export function BarraSuperior({ projetos }: Props) {
  const caminho = usePathname();
  const projetoAtual = projetos.find((p) => caminho.startsWith(`/projetos/${p.id}`));
  const abrirPaleta = () => window.dispatchEvent(new CustomEvent("geof:paleta"));

  const link = (href: string, ativo: boolean, texto: string) => (
    <Link
      key={href}
      href={href}
      className={clsx(
        "relative px-2.5 py-1 text-[13px] whitespace-nowrap transition-colors",
        ativo ? "text-papel-50 after:absolute after:inset-x-2.5 after:-bottom-[9px] after:h-0.5 after:bg-terra-500" : "text-papel-200/70 hover:text-papel-50",
      )}
    >
      {texto}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 bg-tinta-900 text-papel-50">
      <div className="mx-auto flex h-11 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <Marca />
        <span className="hidden h-5 w-px bg-papel-50/15 sm:block" />
        <nav className="hidden items-center md:flex">
          {link("/", caminho === "/", "Mesa")}
          {link("/inteligencia", caminho.startsWith("/inteligencia"), "Inteligência territorial")}
          {link("/legislacao", caminho.startsWith("/legislacao"), "Base legal")}
        </nav>
        {projetoAtual && (
          <div className="hidden min-w-0 items-center gap-2 text-[12px] text-papel-200/80 xl:flex">
            <span className="text-papel-50/40">/</span>
            <span className="truncate text-papel-50">{projetoAtual.nome}</span>
            <span className="carimbo border-papel-50/30 text-papel-100">{MODALIDADE[projetoAtual.modalidade]}</span>
            <span className="truncate">{fasePorCodigo[projetoAtual.fase].nome}</span>
          </div>
        )}
        <button
          onClick={abrirPaleta}
          className="ml-auto flex h-7 items-center gap-2 rounded border border-papel-50/15 bg-papel-50/5 px-2.5 text-[12px] text-papel-200/80 hover:border-papel-50/30 hover:text-papel-50"
          aria-label="Abrir busca e comandos"
        >
          <Search className="size-3.5" />
          <span className="hidden sm:inline">Buscar lote, pessoa, fase…</span>
          <kbd className="mono hidden rounded border border-papel-50/20 px-1 text-[10px] text-papel-200/60 sm:inline">⌘K</kbd>
        </button>
      </div>
    </header>
  );
}
