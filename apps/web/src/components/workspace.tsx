"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Mapa } from "./mapa";
import { Prazo } from "./prazo";
import { Dado, Etiqueta, Ponto, Rotulo, Segmentos, classeBotao } from "./ui";
import type { CamadasMapa } from "@/lib/dados";
import { FASES, fmt, SITUACAO_LOTE, SITUACOES, TIPO_DOCUMENTO, type CodigoFase, type SituacaoLote } from "@/lib/dominio";

export interface LoteResumo {
  codigo: string;
  quadra: number;
  situacao: SituacaoLote;
  area_m2: number;
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
  camadas: CamadasMapa;
  lotes: LoteResumo[];
  fases: FaseResumo[];
  resumo: { familias: number; pessoas: number; areaLotes: number; docsPendentes: number; assinaturasPendentes: number; impugnacoes: number; verticesFora: number };
}

export function Workspace({ projetoId, camadas, lotes, fases, resumo }: Props) {
  const [sel, setSel] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Set<SituacaoLote>>(new Set(SITUACOES));
  const [faseAberta, setFaseAberta] = useState<CodigoFase | null>(() => (fases.find((f) => f.situacao === "em_andamento")?.codigo ?? null));
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
      const alvo = e.target as HTMLElement | null;
      if (alvo && ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName)) return;
      if (e.key === "Escape") setSel(null);
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [mover]);

  const alternar = (s: SituacaoLote) =>
    setFiltro((f) => {
      const n = new Set(f);
      if (n.has(s) && n.size > 1) n.delete(s);
      else n.add(s);
      return n;
    });

  const contagem = (s: SituacaoLote) => lotes.filter((l) => l.situacao === s).length;
  const atual = fases.find((f) => f.situacao === "em_andamento");
  const totalPend = lotes.reduce((s, l) => s + l.pendencias.length, 0);

  return (
    <div className="grid gap-4 xl:grid-cols-[270px_minmax(0,1fr)_340px]">
      {/* Processo */}
      <aside className="painel order-2 self-start xl:order-1" aria-label="Fases do processo">
        <header>
          <h2 className="text-[14px] font-semibold">Processo</h2>
          <span className="text-[12.5px] text-texto-3">{fases.filter((f) => f.situacao === "concluida").length} de 10 fases</span>
        </header>
        <ol>
          {FASES.map((f, i) => {
            const pf = fases.find((x) => x.codigo === f.codigo);
            const s = pf?.situacao ?? "pendente";
            const aberta = faseAberta === f.codigo;
            return (
              <li key={f.codigo} id={`fase-${f.codigo}`} className={clsx("scroll-mt-28 border-b border-borda last:border-b-0", s === "em_andamento" && "bg-ambar-claro/60")}>
                <button type="button" onClick={() => setFaseAberta(aberta ? null : f.codigo)} aria-expanded={aberta} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-realce">
                  <span className={clsx("num flex size-5 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold", s === "concluida" ? "bg-marinho text-white" : s === "em_andamento" ? "bg-[#ffb000] text-texto" : "border border-borda-forte text-texto-3")}>
                    {s === "concluida" ? <Check className="size-3" aria-label="Concluída" /> : i + 1}
                  </span>
                  <span className={clsx("min-w-0 flex-1 text-[13.5px] leading-tight", s === "pendente" ? "text-texto-2" : "text-texto", s === "em_andamento" && "font-semibold")}>{f.curto}</span>
                  {s === "concluida" && <span className="num text-[12px] text-texto-3">{fmt.dataCurta(pf?.concluida_em)}</span>}
                  {s === "em_andamento" && <Etiqueta tom="ambar">Em andamento</Etiqueta>}
                </button>
                {aberta && (
                  <div className="space-y-1.5 px-3 pr-3 pb-2.5 pl-10 text-[13px] leading-snug text-texto-2">
                    <p>{f.descricao}</p>
                    {pf?.prazo_em && s === "em_andamento" && <p>Prazo de {f.prazoDias} dias: <Prazo data={pf.prazo_em} /></p>}
                    <p className="text-texto-3">
                      {pf?.iniciada_em ? `Iniciada em ${fmt.data(pf.iniciada_em)}` : "Não iniciada"}
                      {pf?.documentos ? `, ${pf.documentos} documento${pf.documentos > 1 ? "s" : ""} juntado${pf.documentos > 1 ? "s" : ""}` : ""}
                    </p>
                    <Link href="/legislacao" className="text-azul hover:underline">Base legal desta fase</Link>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </aside>

      {/* Mapa */}
      <div className="order-1 min-w-0 xl:order-2">
        <Mapa
          camadas={camadas}
          selecionado={sel ? `${projetoId}:${sel}` : null}
          aoSelecionar={(uid) => setSel(uid ? uid.split(":")[1] : null)}
          situacoes={filtro.size === SITUACOES.length ? undefined : [...filtro]}
          ocultas={[]}
          className="h-[62vh] min-h-[440px]"
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="mr-1 text-texto-3">Mostrar</span>
          {SITUACOES.map((s) => (
            <button key={s} type="button" onClick={() => alternar(s)} aria-pressed={filtro.has(s)}
              className={clsx("flex h-7 items-center gap-1.5 rounded border px-2", filtro.has(s) ? "border-borda-forte bg-superficie text-texto" : "border-borda bg-transparent text-texto-3 line-through")}>
              <Ponto cor={SITUACAO_LOTE[s].cor} className={clsx(!filtro.has(s) && "opacity-40")} /> {SITUACAO_LOTE[s].rotulo} <span className="num text-texto-3">{contagem(s)}</span>
            </button>
          ))}
          <span className="ml-auto hidden text-[12.5px] text-texto-3 md:inline">
            <kbd>←</kbd> <kbd>→</kbd> percorrem as unidades, <kbd>Esc</kbd> limpa a seleção
          </span>
        </div>
      </div>

      {/* Inspetor */}
      <aside className="painel order-3 self-start" aria-live="polite">
        {lote ? (
          <div>
            <header>
              <h2 className="text-[14px] font-semibold">Unidade <span className="cod">{lote.codigo}</span></h2>
              <div className="flex items-center">
                <button type="button" onClick={() => mover(-1)} className="rounded p-1 text-texto-2 hover:bg-realce" aria-label="Unidade anterior"><ChevronLeft className="size-4" /></button>
                <button type="button" onClick={() => mover(1)} className="rounded p-1 text-texto-2 hover:bg-realce" aria-label="Próxima unidade"><ChevronRight className="size-4" /></button>
                <button type="button" onClick={() => setSel(null)} className="rounded p-1 text-texto-2 hover:bg-realce" aria-label="Limpar seleção"><X className="size-4" /></button>
              </div>
            </header>
            <div className="space-y-3.5 p-3.5">
              <p className="flex items-center gap-2 text-[14px] font-semibold"><Ponto cor={SITUACAO_LOTE[lote.situacao].cor} /> {SITUACAO_LOTE[lote.situacao].rotulo}</p>
              <div className="grid grid-cols-2 gap-3">
                <Dado rotulo="Área (plano UTM)" cod>{fmt.num(lote.area_m2)} m²</Dado>
                <Dado rotulo="Quadra" cod>{String(lote.quadra).padStart(2, "0")}</Dado>
              </div>
              {lote.ocupante ? (
                <div className="border-t border-borda pt-3">
                  <Rotulo>Ocupante</Rotulo>
                  <p className="mt-0.5 text-[14px] font-semibold">{lote.ocupante.nome}</p>
                  <p className="text-[13px] text-texto-2">
                    {lote.ocupante.composicao_familiar} {lote.ocupante.composicao_familiar === 1 ? "pessoa" : "pessoas"}, renda de {fmt.num(lote.ocupante.renda_sm, 1)} SM, {lote.ocupante.tempo_ocupacao_anos} anos de ocupação
                  </p>
                  {lote.ocupante.documentos_pendentes.length > 0 && (
                    <p className="mt-1.5 text-[13px] text-ambar">Falta entregar: {lote.ocupante.documentos_pendentes.map((d) => TIPO_DOCUMENTO[d]).join(", ")}</p>
                  )}
                </div>
              ) : (
                <p className="border-t border-borda pt-3 text-[13.5px] text-texto-2">Sem ocupante identificado no cadastro social.</p>
              )}
              {lote.pendencias.length > 0 && (
                <div className="border-t border-borda pt-3">
                  <Rotulo>Pendências em aberto</Rotulo>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-texto-2">
                    {lote.pendencias.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
              )}
              <Link href={`/projetos/${projetoId}/lotes/${lote.codigo}`} className={classeBotao("primario", "w-full justify-between")}>
                Ficha, vértices, memorial e planta <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <header>
              <h2 className="text-[14px] font-semibold">Situação do núcleo</h2>
            </header>
            <div className="space-y-4 p-3.5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Dado rotulo="Unidades"><span className="num text-[18px] font-semibold">{lotes.length}</span> <span className="text-[12.5px] text-texto-3">{fmt.ha(resumo.areaLotes)}</span></Dado>
                <Dado rotulo="Famílias"><span className="num text-[18px] font-semibold">{resumo.familias}</span> <span className="text-[12.5px] text-texto-3">{resumo.pessoas} pessoas</span></Dado>
                <Dado rotulo="Aptas à CRF"><span className="num text-[18px] font-semibold text-verde">{contagem("apto_crf")}</span> <span className="text-[12.5px] text-texto-3">{fmt.pct(contagem("apto_crf"), lotes.length)}</span></Dado>
                <Dado rotulo="Pendências"><span className={clsx("num text-[18px] font-semibold", totalPend && "text-ambar")}>{totalPend}</span> <span className="text-[12.5px] text-texto-3">em aberto</span></Dado>
              </dl>
              <div>
                <Rotulo className="mb-1.5">Unidades por situação</Rotulo>
                <Segmentos partes={SITUACOES.map((s) => ({ valor: contagem(s), cor: SITUACAO_LOTE[s].cor, rotulo: SITUACAO_LOTE[s].rotulo }))} />
              </div>
              {atual && (
                <div className="border-t border-borda pt-3">
                  <Rotulo>Entregas da fase atual</Rotulo>
                  <p className="mt-0.5 text-[14px] font-semibold">{FASES.find((f) => f.codigo === atual.codigo)?.nome}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-texto-2">
                    {FASES.find((f) => f.codigo === atual.codigo)?.entregas.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                </div>
              )}
              <div className="border-t border-borda pt-3">
                <Rotulo>A resolver</Rotulo>
                <ul className="mt-1 space-y-1 text-[13px]">
                  {resumo.impugnacoes > 0 && <li><Link className="text-azul hover:underline" href={`/projetos/${projetoId}/notificacoes`}>{resumo.impugnacoes} impugnação a decidir</Link></li>}
                  {resumo.assinaturasPendentes > 0 && <li><Link className="text-azul hover:underline" href={`/projetos/${projetoId}/documentos`}>{resumo.assinaturasPendentes} assinatura{resumo.assinaturasPendentes > 1 ? "s" : ""} pendente{resumo.assinaturasPendentes > 1 ? "s" : ""}</Link></li>}
                  {resumo.docsPendentes > 0 && <li><Link className="text-azul hover:underline" href={`/projetos/${projetoId}/lotes`}>{resumo.docsPendentes} documentos de ocupantes faltando</Link></li>}
                  {resumo.verticesFora > 0 && <li><Link className="text-azul hover:underline" href={`/projetos/${projetoId}/levantamento`}>{resumo.verticesFora} vértices a remedir</Link></li>}
                  {!resumo.impugnacoes && !resumo.assinaturasPendentes && !resumo.docsPendentes && !resumo.verticesFora && <li className="text-texto-2">Nada pendente.</li>}
                </ul>
              </div>
              <p className="border-t border-borda pt-3 text-[12.5px] text-texto-3">Clique numa unidade do mapa para ver o ocupante e as pendências.</p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
