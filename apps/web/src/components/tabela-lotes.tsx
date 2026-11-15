"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { Ponto, Tabela } from "./ui";
import { fmt, SITUACAO_LOTE, SITUACOES, TIPO_DOCUMENTO, type SituacaoLote } from "@/lib/dominio";

export interface LinhaLote {
  codigo: string;
  quadra: number;
  area_m2: number;
  situacao: SituacaoLote;
  ocupante: string | null;
  cpf: string | null;
  renda_sm: number | null;
  familia: number | null;
  docs_pendentes: string[];
  pendencias: number;
}

type Ordem = keyof Pick<LinhaLote, "codigo" | "area_m2" | "renda_sm" | "pendencias">;

export function TabelaLotes({ projetoId, linhas, limiteRendaSm }: { projetoId: number; linhas: LinhaLote[]; limiteRendaSm: number | null }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<SituacaoLote | "todos" | "docs">("todos");
  const [ordem, setOrdem] = useState<{ por: Ordem; asc: boolean }>({ por: "codigo", asc: true });

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = linhas.filter(
      (l) =>
        (filtro === "todos" || (filtro === "docs" ? l.docs_pendentes.length > 0 : l.situacao === filtro)) &&
        (!q || l.codigo.toLowerCase().includes(q) || l.ocupante?.toLowerCase().includes(q)),
    );
    return [...base].sort((a, b) => {
      const va = a[ordem.por] ?? -1, vb = b[ordem.por] ?? -1;
      const r = typeof va === "string" ? va.localeCompare(String(vb)) : Number(va) - Number(vb);
      return ordem.asc ? r : -r;
    });
  }, [linhas, busca, filtro, ordem]);

  const th = (por: Ordem, texto: string) => (
    <button key={por} type="button" onClick={() => setOrdem((o) => ({ por, asc: o.por === por ? !o.asc : true }))} className="flex items-center gap-1 font-semibold hover:text-azul" aria-label={`Ordenar por ${texto}`}>
      {texto} {ordem.por === por && (ordem.asc ? <ArrowUp className="size-3.5" aria-label="crescente" /> : <ArrowDown className="size-3.5" aria-label="decrescente" />)}
    </button>
  );
  const opcoes: (SituacaoLote | "todos" | "docs")[] = ["todos", ...SITUACOES, "docs"];

  return (
    <div className="painel">
      <div className="flex flex-wrap items-center gap-3 border-b border-borda p-3">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Buscar unidade ou ocupante</span>
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-texto-3" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por unidade (Q01-L03) ou nome do ocupante"
            className="h-8 w-full rounded border border-borda-forte bg-superficie pr-3 pl-8 text-[13.5px] placeholder:text-texto-3" />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-texto-2">
          Situação
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="h-8 rounded border border-borda-forte bg-superficie px-2 text-[13.5px] text-texto">
            {opcoes.map((s) => (
              <option key={s} value={s}>
                {s === "todos" ? `Todas (${linhas.length})` : s === "docs" ? `Com documento faltando (${linhas.filter((l) => l.docs_pendentes.length).length})` : `${SITUACAO_LOTE[s].rotulo} (${linhas.filter((l) => l.situacao === s).length})`}
              </option>
            ))}
          </select>
        </label>
        <span className="num text-[13px] text-texto-3" aria-live="polite">{visiveis.length} de {linhas.length}</span>
      </div>
      <Tabela cabecalho={[th("codigo", "Unidade"), "Situação", "Ocupante", "CPF", "Pessoas", th("renda_sm", "Renda (SM)"), th("area_m2", "Área (m²)"), "Documentos", th("pendencias", "Pendências")]}>
        {visiveis.map((l) => (
          <tr key={l.codigo} className="hover:bg-realce">
            <td className="px-3 py-2"><Link href={`/projetos/${projetoId}/lotes/${l.codigo}`} className="cod font-medium text-azul hover:underline">{l.codigo}</Link></td>
            <td className="px-3 py-2"><span className="flex items-center gap-1.5"><Ponto cor={SITUACAO_LOTE[l.situacao].cor} /> {SITUACAO_LOTE[l.situacao].rotulo}</span></td>
            <td className="px-3 py-2">{l.ocupante ?? <span className="text-texto-3">sem ocupante identificado</span>}</td>
            <td className="cod px-3 py-2 text-texto-2">{l.cpf ?? ""}</td>
            <td className="px-3 py-2 text-right">{l.familia ?? ""}</td>
            <td className={clsx("px-3 py-2 text-right", limiteRendaSm && l.renda_sm && l.renda_sm > limiteRendaSm && "font-semibold text-vermelho")}>{l.renda_sm != null ? fmt.num(l.renda_sm, 1) : ""}</td>
            <td className="px-3 py-2 text-right">{fmt.num(l.area_m2)}</td>
            <td className="px-3 py-2">
              {l.docs_pendentes.length ? <span className="text-ambar" title={l.docs_pendentes.map((d) => TIPO_DOCUMENTO[d]).join(", ")}>faltam {l.docs_pendentes.length}</span> : l.ocupante ? <span className="text-verde">completos</span> : ""}
            </td>
            <td className="px-3 py-2 text-right">{l.pendencias ? <span className="font-semibold text-ambar">{l.pendencias}</span> : <span className="text-texto-3">0</span>}</td>
          </tr>
        ))}
      </Tabela>
      {!visiveis.length && <p className="p-6 text-center text-[13.5px] text-texto-2">Nenhuma unidade corresponde à busca. Limpe o texto ou escolha outra situação.</p>}
    </div>
  );
}
