"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BookOpenText, LayoutDashboard, MapPinned, Scale } from "lucide-react";
import { MODALIDADE } from "@/lib/dominio";

interface Props {
  projetos: { id: number; nome: string; modalidade: string }[];
}

export function BarraLateral({ projetos }: Props) {
  const caminho = usePathname();
  const item = (href: string, ativo: boolean) =>
    clsx(
      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
      ativo ? "bg-terra-800 text-white" : "text-terra-100/80 hover:bg-terra-900 hover:text-white",
    );

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center gap-3 overflow-x-auto bg-terra-950 px-4 py-3 lg:hidden">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-sm font-semibold text-white">
          <MapPinned className="size-4 text-terra-300" /> REURB Livre
        </Link>
        <Link href="/legislacao" className="shrink-0 text-xs text-terra-100/80">Fluxo legal</Link>
        {projetos.map((p) => (
          <Link key={p.id} href={`/projetos/${p.id}`} className="shrink-0 text-xs text-terra-100/80">
            {p.nome.replace("Núcleo ", "")}
          </Link>
        ))}
      </header>
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-terra-950 px-3 py-5 lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-3">
        <span className="grid size-8 place-items-center rounded-lg bg-terra-400 text-terra-950">
          <MapPinned className="size-4.5" strokeWidth={2.4} />
        </span>
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold text-white">REURB Livre</span>
          <span className="block text-[11px] text-terra-200/70">regularização fundiária aberta</span>
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        <Link href="/" className={item("/", caminho === "/")}>
          <LayoutDashboard className="size-4" /> Painel
        </Link>
        <Link href="/legislacao" className={item("/legislacao", caminho.startsWith("/legislacao"))}>
          <Scale className="size-4" /> Fluxo legal e normas
        </Link>
      </nav>

      <p className="mt-8 mb-2 px-3 text-[11px] font-medium tracking-wider text-terra-200/50 uppercase">Núcleos</p>
      <nav className="flex flex-col gap-1">
        {projetos.map((p) => (
          <Link key={p.id} href={`/projetos/${p.id}`} className={item(`/projetos/${p.id}`, caminho.startsWith(`/projetos/${p.id}`))}>
            <span className="min-w-0 flex-1 truncate">{p.nome.replace("Núcleo ", "")}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium">{MODALIDADE[p.modalidade]}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto rounded-xl bg-terra-900/70 p-3 text-xs text-terra-100/80">
        <p className="flex items-center gap-1.5 font-medium text-white">
          <BookOpenText className="size-3.5" /> Protótipo
        </p>
        <p className="mt-1">Dados fictícios. Código aberto, base de dados PostGIS no padrão LADM (ISO 19152).</p>
      </div>
    </aside>
    </>
  );
}
