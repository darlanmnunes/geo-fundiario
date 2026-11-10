"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { MapaNucleo, type LoteMapa } from "./mapa-nucleo";
import { Prazo } from "./prazo";
import { Carimbo, Dado, Numero, Ponto, Rotulo, Segmentos } from "./ui";
import { FASES, fmt, SITUACAO_LOTE, TIPO_DOCUMENTO, type CodigoFase, type SituacaoLote } from "@/lib/dominio";

export interface LoteResumo {
  codigo: string;
  quadra: number;
  situacao: SituacaoLote;
  area_m2: number;
  edificado: boolean;
  ocupante: { nome: string; renda_sm: number; composicao_familiar: number; tempo_ocupacao_anos: number; documentos_pendentes: string[] } | null;
  pendencias: string[];
}

export interface FaseResumo {
  codigo: CodigoFase;
  situacao: string;
  iniciada_em: string | null;
  concluida_em: string | null;
  prazo_em: string | null;
  documentos: number;
}

interface Props {
  projetoId: number;
  modalidade: string;
  camadas: { perimetro: GeoJSON.Feature; quadras: GeoJSON.FeatureCollection; logradouros: GeoJSON.FeatureCollection };
  lotesMapa: GeoJSON.FeatureCollection<GeoJSON.Geometry, LoteMapa>;
  lotes: LoteResumo[];
  fases: FaseResumo[];
  resumo: { familias: number; pessoas: number; areaLotes: number; docsPendentes: number; assinaturasPendentes: number; impugnacoes: number };
}

const TODAS = Object.keys(SITUACAO_LOTE) as SituacaoLote[];

export function Workspace({ projetoId, modalidade, camadas, lotesMapa, lotes, fases, resumo }: Props) {
  const [sel, setSel] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Set<SituacaoLote>>(new Set(TODAS));
  const visiveis = useMemo(() => ({ ...lotesMapa, features: lotesMapa.features.filter((f) => filtro.has(f.properties.situacao as SituacaoLote)) }), [lotesMapa, filtro]);
  const ordem = useMemo(() => lotes.filter((l) => filtro.has(l.situacao)).map((l) => l.codigo), [lotes, filtro]);
  const lote = lotes.find((l) => l.codigo === sel) ?? null;

  const mover = useCallback(
    (delta: number) => {
      if (!ordem.length) return;
      const i = sel ? ordem.indexOf(sel) : -1;
      setSel(ordem[(i + delta + ordem.length) % ordem.length]);
    },
    [ordem, sel],
  );

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape") setSel(null);
      if (e.key === "ArrowRight" || e.key === "j") mover(1);
      if (e.key === "ArrowLeft" || e.key === "k") mover(-1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [mover]);

  const alternar = (s: SituacaoLote, so = false) =>
    setFiltro((f) => {
      if (so) return new Set([s]);
      const n = new Set(f);
      if (n.has(s) && n.size > 1) n.delete(s);
      else n.add(s);
      return n;
    });

  const contagem = (s: SituacaoLote) => lotes.filter((l) => l.situacao === s).length;
  const atual = fases.find((f) => f.situacao === "em_andamento");

  return (
    <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_330px]">
      {/* Processo */}
      <aside className="painel order-2 xl:order-1">
        <header>
          <h2 className="font-sans text-[13px] font-semibold">Processo</h2>
          <span className="rotulo">art. 28</span>
        </header>
        <ol className="divide-y divide-[color:var(--linha)]">
          {FASES.map((f, i) => {
            const pf = fases.find((x) => x.codigo === f.codigo);
            const s = pf?.situacao ?? "pendente";
            return (
              <li key={f.codigo} id={`fase-${f.codigo}`} className={clsx("scroll-mt-24 px-3 py-2", s === "em_andamento" && "bg-terra-100/40")}>
                <div className="flex items-baseline gap-2">
                  <span className={clsx("tab w-5 shrink-0 text-[11px]", s === "pendente" ? "text-tinta-300" : "text-tinta-500")}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={clsx("min-w-0 flex-1 text-[13px] leading-tight", s === "pendente" ? "text-tinta-500" : "text-tinta-900", s === "em_andamento" && "font-medium")}>{f.curto}</span>
                  {s === "concluida" && <span className="tab text-[11px] text-tinta-500">{fmt.dataCurta(pf?.concluida_em)}</span>}
                  {s === "em_andamento" && <Carimbo tom="terra">atual</Carimbo>}
                </div>
                {s === "em_andamento" && (
                  <div className="mt-1.5 space-y-1 pl-7 text-[12px] text-tinta-700">
                    <p className="leading-snug">{f.descricao}</p>
                    {pf?.prazo_em && <p>Prazo de {f.prazoDias} d: <Prazo data={pf.prazo_em} /></p>}
                    {!!pf?.documentos && <p className="text-tinta-500">{pf.documentos} documento(s) nesta fase</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </aside>

      {/* Mapa */}
      <div className="order-1 min-w-0 xl:order-2">
        <MapaNucleo {...camadas} lotes={visiveis} selecionado={sel} aoSelecionar={setSel} className="h-[62vh] min-h-[420px]" />
        <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-[12px]">
          <span className="rotulo mr-1">Situação</span>
          {TODAS.map((s) => (
            <button
              key={s}
              onClick={(e) => alternar(s, e.altKey)}
              title="Clique para alternar; Alt+clique para isolar"
              className={clsx("flex items-center gap-1.5 rounded border px-2 py-0.5", filtro.has(s) ? "border-tinta-900/20 bg-papel-50 text-tinta-900" : "border-transparent text-tinta-300 line-through")}
            >
              <Ponto cor={SITUACAO_LOTE[s].cor} /> {SITUACAO_LOTE[s].rotulo} <span className="tab text-tinta-500">{contagem(s)}</span>
            </button>
          ))}
          <span className="ml-auto text-tinta-500">
            <kbd className="mono">←</kbd> <kbd className="mono">→</kbd> percorrer lotes · <kbd className="mono">esc</kbd> limpar
          </span>
        </div>
      </div>

      {/* Inspetor */}
      <aside className="painel order-3 self-start">
        {lote ? (
          <div className="surgir">
            <header>
              <div>
                <Rotulo>Lote selecionado</Rotulo>
                <h2 className="serif text-[22px] leading-none">{lote.codigo}</h2>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => mover(-1)} className="rounded p-1 hover:bg-papel-100" aria-label="Lote anterior"><ChevronLeft className="size-4" /></button>
                <button onClick={() => mover(1)} className="rounded p-1 hover:bg-papel-100" aria-label="Próximo lote"><ChevronRight className="size-4" /></button>
                <button onClick={() => setSel(null)} className="rounded p-1 hover:bg-papel-100" aria-label="Limpar seleção"><X className="size-4" /></button>
              </div>
            </header>
            <div className="space-y-4 p-4">
              <p className="flex items-center gap-2 text-[13px]"><Ponto cor={SITUACAO_LOTE[lote.situacao].cor} /> {SITUACAO_LOTE[lote.situacao].rotulo}</p>
              <div className="grid grid-cols-2 gap-3">
                <Dado rotulo="Área (UTM)" mono>{fmt.num(lote.area_m2)} m²</Dado>
                <Dado rotulo="Quadra" mono>{String(lote.quadra).padStart(2, "0")}</Dado>
                <Dado rotulo="Edificado">{lote.edificado ? "Sim" : "Não"}</Dado>
                <Dado rotulo="Pendências" mono>{lote.pendencias.length}</Dado>
              </div>
              {lote.ocupante ? (
                <div className="border-t fio pt-3">
                  <Rotulo>Ocupante</Rotulo>
                  <p className="mt-0.5 text-[14px] font-medium">{lote.ocupante.nome}</p>
                  <p className="text-[12.5px] text-tinta-500">
                    {lote.ocupante.composicao_familiar} pessoas · {fmt.num(lote.ocupante.renda_sm, 1)} SM · {lote.ocupante.tempo_ocupacao_anos} anos no lote
                  </p>
                  {lote.ocupante.documentos_pendentes.length > 0 && (
                    <p className="mt-1.5 text-[12.5px] text-ocre-700">Faltam: {lote.ocupante.documentos_pendentes.map((d) => TIPO_DOCUMENTO[d]).join(", ")}</p>
                  )}
                </div>
              ) : (
                <p className="border-t fio pt-3 text-[13px] text-tinta-500">Lote sem ocupante identificado.</p>
              )}
              {lote.pendencias.length > 0 && (
                <ul className="space-y-1 border-t fio pt-3 text-[12.5px] text-tinta-700">
                  {lote.pendencias.map((x) => <li key={x} className="flex gap-2"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-ocre-600" />{x}</li>)}
                </ul>
              )}
              <Link href={`/projetos/${projetoId}/lotes/${lote.codigo}`} className="flex items-center justify-between rounded bg-tinta-900 px-3 py-2 text-[13px] font-medium text-papel-50 hover:bg-tinta-700">
                Ficha, vértices e memorial <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <header>
              <h2 className="font-sans text-[13px] font-semibold">Situação do núcleo</h2>
              <span className="rotulo">{modalidade === "reurb_s" ? "interesse social" : "interesse específico"}</span>
            </header>
            <div className="space-y-5 p-4">
              <div className="grid grid-cols-2 gap-4">
                <Numero rotulo="Lotes" valor={lotes.length} detalhe={`${fmt.num(resumo.areaLotes / 10_000, 2)} ha`} />
                <Numero rotulo="Famílias" valor={resumo.familias} detalhe={`${resumo.pessoas} pessoas`} />
                <Numero rotulo="Aptos à CRF" valor={contagem("apto_crf")} tom="ok" detalhe={`${Math.round((contagem("apto_crf") / lotes.length) * 100)}% dos lotes`} />
                <Numero rotulo="Pendências" valor={lotes.reduce((s, l) => s + l.pendencias.length, 0)} tom="alerta" detalhe={`${resumo.docsPendentes} documentos faltando`} />
              </div>
              <div>
                <Rotulo className="mb-1.5">Lotes por situação</Rotulo>
                <Segmentos partes={TODAS.map((s) => ({ valor: contagem(s), cor: SITUACAO_LOTE[s].cor, rotulo: SITUACAO_LOTE[s].rotulo }))} altura="h-2.5" />
              </div>
              {atual && (
                <div className="border-t fio pt-3 text-[13px]">
                  <Rotulo>Fase atual</Rotulo>
                  <p className="mt-0.5 font-medium">{FASES.find((f) => f.codigo === atual.codigo)?.nome}</p>
                  <ul className="mt-1.5 space-y-0.5 text-[12.5px] text-tinta-700">
                    {FASES.find((f) => f.codigo === atual.codigo)?.entregas.map((e) => <li key={e}>· {e}</li>)}
                  </ul>
                </div>
              )}
              <div className="border-t fio pt-3 text-[12.5px] text-tinta-700">
                <Rotulo className="mb-1">A resolver</Rotulo>
                <ul className="space-y-0.5">
                  {resumo.impugnacoes > 0 && <li>{resumo.impugnacoes} impugnação a decidir</li>}
                  {resumo.assinaturasPendentes > 0 && <li>{resumo.assinaturasPendentes} assinatura pendente</li>}
                  <li>{resumo.docsPendentes} documentos de ocupantes faltando</li>
                </ul>
              </div>
              <p className="text-[12px] text-tinta-500">Clique num lote do mapa ou use <kbd className="mono">⌘K</kbd> para buscar.</p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
