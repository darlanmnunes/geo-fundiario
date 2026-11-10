import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AbasProjeto } from "@/components/abas-projeto";
import { TrilhaFases } from "@/components/trilha-fases";
import { Carimbo } from "@/components/ui";
import { listarProjetos, obterProjeto } from "@/lib/dados";
import { MODALIDADE } from "@/lib/dominio";

export function generateStaticParams() {
  return listarProjetos().map((p) => ({ id: String(p.id) }));
}

async function CabecalhoProjeto({ params }: Pick<LayoutProps<"/projetos/[id]">, "params">) {
  const p = obterProjeto((await params).id);
  if (!p) notFound();
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div className="min-w-0">
        <p className="rotulo">
          Processo {p.processo_adm} · {p.municipio}/{p.uf} · EPSG:{p.srid_utm}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[26px] leading-none">{p.nome}</h1>
          <Carimbo tom={p.modalidade === "reurb_s" ? "terra" : "registro"}>{MODALIDADE[p.modalidade]}</Carimbo>
        </div>
        <p className="mt-1.5 text-[12.5px] text-tinta-500">Legitimado: {p.legitimado} · RT: {p.responsavel_tecnico}</p>
      </div>
      <TrilhaFases fases={p.fases} className="w-full max-w-xs" />
    </div>
  );
}

export default function LayoutProjeto({ children, params }: LayoutProps<"/projetos/[id]">) {
  return (
    <div>
      <div className="border-b fio bg-papel-50">
        <div className="mx-auto max-w-[1600px] px-4 pt-5 sm:px-6">
          <Suspense fallback={<div className="h-[84px] animate-pulse rounded bg-papel-200/60" />}>
            <CabecalhoProjeto params={params} />
          </Suspense>
          <div className="mt-4">
            <AbasProjeto />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">{children}</div>
    </div>
  );
}
