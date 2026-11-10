import clsx from "clsx";
import type { ReactNode } from "react";

/** Superfície branca com fio. `titulo` vai no cabeçalho; `aside` à direita dele. */
export function Painel({ titulo, aside, children, className, corpo }: { titulo?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; corpo?: string }) {
  return (
    <section className={clsx("painel", className)}>
      {titulo && (
        <header>
          <h2 className="font-sans text-[13px] font-semibold tracking-normal text-tinta-900">{titulo}</h2>
          {aside && <div className="text-[12px] text-tinta-500">{aside}</div>}
        </header>
      )}
      <div className={corpo ?? "p-4"}>{children}</div>
    </section>
  );
}

export function Rotulo({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx("rotulo block", className)}>{children}</span>;
}

/** Par rótulo/valor típico de ficha técnica. */
export function Dado({ rotulo, children, mono = false, className }: { rotulo: ReactNode; children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={clsx("min-w-0", className)}>
      <Rotulo>{rotulo}</Rotulo>
      <div className={clsx("mt-0.5 text-[13.5px] text-tinta-900", mono && "mono")}>{children}</div>
    </div>
  );
}

/** Número de destaque em serifa, como numa capa de relatório. */
export function Numero({ rotulo, valor, detalhe, tom = "neutro" }: { rotulo: ReactNode; valor: ReactNode; detalhe?: ReactNode; tom?: "neutro" | "alerta" | "ok" | "info" }) {
  return (
    <div className="min-w-0 border-l fio-forte pl-3">
      <Rotulo>{rotulo}</Rotulo>
      <div className={clsx("serif tab mt-0.5 text-[28px] leading-none", tom === "alerta" && "text-ocre-700", tom === "ok" && "text-oliva-700", tom === "info" && "text-registro-700")}>{valor}</div>
      {detalhe && <div className="mt-1 text-[12px] text-tinta-500">{detalhe}</div>}
    </div>
  );
}

export function Carimbo({ children, tom = "neutro", className }: { children: ReactNode; tom?: "neutro" | "terra" | "oliva" | "ocre" | "registro" | "carimbo"; className?: string }) {
  const cor = { neutro: "text-tinta-500", terra: "text-terra-600", oliva: "text-oliva-700", ocre: "text-ocre-700", registro: "text-registro-600", carimbo: "text-carimbo-600" }[tom];
  return <span className={clsx("carimbo", cor, className)}>{children}</span>;
}

export function Ponto({ cor, className }: { cor: string; className?: string }) {
  return <span className={clsx("inline-block size-2 shrink-0 rounded-[2px]", className)} style={{ background: cor }} />;
}

export function Cabecalho({ sobretitulo, titulo, descricao, acoes }: { sobretitulo?: ReactNode; titulo: ReactNode; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {sobretitulo && <Rotulo>{sobretitulo}</Rotulo>}
        <h1 className="mt-1 text-[30px] leading-[1.1] text-tinta-900">{titulo}</h1>
        {descricao && <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-tinta-700">{descricao}</p>}
      </div>
      {acoes}
    </div>
  );
}

export function Carregando() {
  return (
    <div className="grid gap-3 md:grid-cols-3" aria-busy="true">
      {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-md bg-papel-200/70" />)}
    </div>
  );
}

/** Tabela técnica: cabeçalho em rótulo, números tabulares, linhas com fio. */
export function Tabela({ cabecalho, children, className }: { cabecalho: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("overflow-x-auto", className)}>
      <table className="tab w-full text-[13px] whitespace-nowrap">
        <thead>
          <tr className="border-b fio-forte text-left">
            {cabecalho.map((c, i) => <th key={i} className="rotulo py-2 pr-4 font-medium first:pl-0">{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--linha)]">{children}</tbody>
      </table>
    </div>
  );
}

/** Barra segmentada de proporções. */
export function Segmentos({ partes, altura = "h-1.5" }: { partes: { valor: number; cor: string; rotulo?: string }[]; altura?: string }) {
  const total = partes.reduce((s, p) => s + p.valor, 0) || 1;
  return (
    <div className={clsx("flex w-full overflow-hidden rounded-[2px] bg-papel-200", altura)}>
      {partes.map((p, i) => <span key={i} title={p.rotulo} style={{ width: `${(p.valor / total) * 100}%`, background: p.cor }} />)}
    </div>
  );
}
