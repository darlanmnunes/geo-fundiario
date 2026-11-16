import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { AbasProjeto } from "@/components/abas-projeto";
import { TrilhaFases } from "@/components/trilha-fases";
import { Etiqueta, classeBotao } from "@/components/ui";
import { listarProjetos, obterProjeto } from "@/lib/dados";
import { MODALIDADE, MODALIDADE_LONGA } from "@/lib/dominio";

export function generateStaticParams() {
  return listarProjetos().map((p) => ({ id: String(p.id) }));
}

async function CabecalhoProjeto({ params }: Pick<LayoutProps<"/projetos/[id]">, "params">) {
  const p = obterProjeto((await params).id);
  if (!p) notFound();
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[22px] leading-tight font-semibold">{p.nome}</h1>
          <Etiqueta tom={p.modalidade === "reurb_s" ? "azul" : "roxo"}>{MODALIDADE[p.modalidade]} - {MODALIDADE_LONGA[p.modalidade]}</Etiqueta>
        </div>
        <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 text-[13px] text-texto-2">
          <div className="flex gap-1.5"><dt className="text-texto-3">Processo</dt><dd className="cod">{p.processo_adm}</dd></div>
          <div className="flex gap-1.5"><dt className="text-texto-3">Município</dt><dd>{p.municipio}/{p.uf}</dd></div>
          <div className="flex gap-1.5"><dt className="text-texto-3">Legitimado</dt><dd>{p.legitimado}</dd></div>
          <div className="flex gap-1.5"><dt className="text-texto-3">Responsável técnico</dt><dd>{p.responsavel_tecnico}</dd></div>
        </dl>
      </div>
      <TrilhaFases fases={p.fases} className="w-full max-w-xs" />
    </div>
  );
}

export default function LayoutProjeto({ children, params }: LayoutProps<"/projetos/[id]">) {
  return (
    <div>
      <div className="border-b border-borda bg-superficie">
        <div className="mx-auto w-full max-w-[1680px] px-4 pt-3 sm:px-6">
          <nav aria-label="Você está em" className="mb-2.5 flex flex-wrap items-center gap-2 text-[13px]">
            <Link href="/painel" className={classeBotao("secundario", "h-7 px-2.5")}><ArrowLeft className="size-3.5" aria-hidden /> Visão geral</Link>
            <ChevronRight className="size-3.5 text-texto-3" aria-hidden />
            <span className="text-texto-2">Núcleos</span>
          </nav>
          <Suspense fallback={<div className="h-[60px] animate-pulse rounded bg-borda/60" />}>
            <CabecalhoProjeto params={params} />
          </Suspense>
          <div className="mt-3">
            <AbasProjeto />
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1680px] px-4 py-4 sm:px-6">{children}</div>
    </div>
  );
}
