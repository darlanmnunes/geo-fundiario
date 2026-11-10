"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Search } from "lucide-react";
import { Ponto, Tabela } from "./ui";
import { fmt, SITUACAO_LOTE, TIPO_DOCUMENTO, type SituacaoLote } from "@/lib/dominio";

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

function Ordenador({ por, ordem, aoOrdenar, direita, children }: { por: Ordem; ordem: { por: Ordem; asc: boolean }; aoOrdenar: (p: Ordem) => void; direita?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={() => aoOrdenar(por)} className={clsx("rotulo flex items-center gap-1 hover:text-tinta-900", direita && "ml-auto")}>
      {children} {ordem.por === por && <span aria-hidden>{ordem.asc ? "↑" : "↓"}</span>}
    </button>
  );
}

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

  const ordenar = (por: Ordem) => setOrdem((o) => ({ por, asc: o.por === por ? !o.asc : true }));
  const th = (por: Ordem, texto: string, direita = false) => <Ordenador key={por} por={por} ordem={ordem} aoOrdenar={ordenar} direita={direita}>{texto}</Ordenador>;

  return (
    <div className="painel">
      <div className="flex flex-wrap items-center gap-3 border-b fio p-3">
        <label className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-tinta-300" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Lote ou nome do ocupante"
            className="w-full rounded border fio bg-papel-50 py-1.5 pr-3 pl-8 text-[13px] outline-none focus:border-tinta-900/40"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {(["todos", ...Object.keys(SITUACAO_LOTE), "docs"] as (SituacaoLote | "todos" | "docs")[]).map((s) => (
            <button
              key={s}
              onClick={() => setFiltro(s)}
              className={clsx("flex items-center gap-1.5 rounded border px-2 py-0.5 text-[12px]", filtro === s ? "border-tinta-900 bg-tinta-900 text-papel-50" : "fio bg-papel-50 text-tinta-700 hover:border-tinta-900/40")}
            >
              {s !== "todos" && s !== "docs" && <Ponto cor={SITUACAO_LOTE[s].cor} />}
              {s === "todos" ? `Todos (${linhas.length})` : s === "docs" ? `Faltam documentos (${linhas.filter((l) => l.docs_pendentes.length).length})` : `${SITUACAO_LOTE[s].rotulo} (${linhas.filter((l) => l.situacao === s).length})`}
            </button>
          ))}
        </div>
      </div>
      <div className="px-3">
        <Tabela cabecalho={[th("codigo", "Lote"), "Situação", "Ocupante", "CPF", "Família", th("renda_sm", "Renda (SM)", true), th("area_m2", "Área m²", true), "Documentos", th("pendencias", "Pend.", true)]}>
          {visiveis.map((l) => (
            <tr key={l.codigo} className="hover:bg-papel-100/70">
              <td className="py-2 pr-4"><Link href={`/projetos/${projetoId}/lotes/${l.codigo}`} className="mono font-medium text-terra-700 hover:underline">{l.codigo}</Link></td>
              <td className="py-2 pr-4"><span className="flex items-center gap-1.5 text-tinta-700"><Ponto cor={SITUACAO_LOTE[l.situacao].cor} /> {SITUACAO_LOTE[l.situacao].rotulo}</span></td>
              <td className="py-2 pr-4 text-tinta-900">{l.ocupante ?? <span className="text-tinta-300">lote vazio</span>}</td>
              <td className="mono py-2 pr-4 text-tinta-500">{l.cpf ?? "—"}</td>
              <td className="py-2 pr-4 text-right">{l.familia ?? "—"}</td>
              <td className={clsx("py-2 pr-4 text-right", limiteRendaSm && l.renda_sm && l.renda_sm > limiteRendaSm && "font-medium text-carimbo-600")}>{l.renda_sm != null ? fmt.num(l.renda_sm, 1) : "—"}</td>
              <td className="py-2 pr-4 text-right">{fmt.num(l.area_m2)}</td>
              <td className="py-2 pr-4 text-[12px]">
                {l.docs_pendentes.length ? <span className="text-ocre-700" title={l.docs_pendentes.map((d) => TIPO_DOCUMENTO[d]).join(", ")}>faltam {l.docs_pendentes.length}</span> : l.ocupante ? <span className="text-oliva-700">completos</span> : "—"}
              </td>
              <td className="py-2 text-right">{l.pendencias ? <span className="font-medium text-ocre-700">{l.pendencias}</span> : "—"}</td>
            </tr>
          ))}
        </Tabela>
        {!visiveis.length && <p className="p-6 text-center text-[13px] text-tinta-500">Nenhum lote encontrado.</p>}
      </div>
    </div>
  );
}
